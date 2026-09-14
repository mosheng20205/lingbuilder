import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, CloudUpload, Download, FileArchive, FileCode2, Globe2, Heart, Image as ImageIcon, Link2, MessageCircle, PackagePlus, Search, Upload } from 'lucide-react';
import { R2MultipartUploader, UploadCancelledError, computeFileSha256Hex, formatFileSize, versionFromFileName } from './r2UploadClient';
import './website-admin.css';

type Request = (path: string, init?: RequestInit) => Promise<any>;
type Section = 'downloads' | 'commands' | 'guides' | 'demos' | 'groups' | 'sponsors';
export type DirectNotice = { text: string; error?: boolean } | null;

const SECTIONS: Array<{id: Section; label: string; icon: typeof Globe2}> = [
  { id: 'downloads', label: '版本与下载', icon: Download },
  { id: 'commands', label: '命令资料', icon: Search },
  { id: 'guides', label: '控件与教程', icon: BookOpen },
  { id: 'demos', label: '示例源码', icon: FileCode2 },
  { id: 'groups', label: '交流群', icon: MessageCircle },
  { id: 'sponsors', label: '赞助名单', icon: Heart }
];

export function WebsiteContentAdmin({ data, request, reload }: { data: any; request: Request; reload: () => Promise<void> }) {
  const [section, setSection] = useState<Section>('downloads');
  return <div className="site-admin">
    <section className="site-admin-intro"><div><Globe2/><span>WEBSITE CONTENT</span><h2>官网内容管理</h2><p>公开页面只读取已发布内容；保存草稿不会提前展示。所有更新都会写入管理员审计日志。</p></div><a href="/" target="_blank" rel="noreferrer">查看官网</a></section>
    <nav className="site-admin-tabs" aria-label="官网内容分类">{SECTIONS.map(item => { const Icon = item.icon; return <button key={item.id} className={section === item.id ? 'active' : ''} onClick={() => setSection(item.id)}><Icon size={16}/>{item.label}<span>{countFor(item.id, data)}</span></button>; })}</nav>
    {section === 'downloads' && <DownloadsAdmin data={data} request={request} reload={reload}/>} 
    {section === 'commands' && <CommandsAdmin data={data} request={request} reload={reload}/>} 
    {section === 'guides' && <GuidesAdmin data={data} request={request} reload={reload}/>} 
    {section === 'demos' && <DemosAdmin data={data} request={request} reload={reload}/>} 
    {section === 'groups' && <GroupsAdmin data={data} request={request} reload={reload}/>}
    {section === 'sponsors' && <SponsorsAdmin data={data} request={request} reload={reload}/>}
  </div>;
}

function DownloadsAdmin({ data, request, reload }: AdminProps) {
  const releases = data?.downloads || [];
  const [release, setRelease] = useState<any>(emptyRelease());
  const [editingId, setEditingId] = useState('');
  const [expandedReleaseId, setExpandedReleaseId] = useState('');
  const [mirrorDraft, setMirrorDraft] = useState<any | null>(null);
  const [pendingDirectUrl, setPendingDirectUrl] = useState('');
  const [directNotice, setDirectNotice] = useState<DirectNotice>(null);
  const [uploadEpoch, setUploadEpoch] = useState(0);
  const startNewRelease = () => { setRelease(emptyRelease()); setEditingId(''); setPendingDirectUrl(''); setDirectNotice(null); setUploadEpoch(value => value + 1); };
  const openMirror = (releaseId: string, entry?: any) => { setExpandedReleaseId(releaseId); setMirrorDraft(entry ? { ...entry, releaseId } : { releaseId, provider: '', label: '', url: '', accessCode: '', enabled: true, sortOrder: 0 }); };
  const closeMirror = () => { setMirrorDraft(null); setExpandedReleaseId(''); };
  const writeDirectMirror = async (releaseId: string, url: string, mirrors: any[]) => {
    const existing = (mirrors || []).find((entry: any) => entry.label === '直链' || entry.provider === 'direct');
    await post(request, '/v1/admin/site/download-mirrors', {
      releaseId,
      provider: existing?.provider || 'direct',
      label: '直链',
      url,
      accessCode: '',
      enabled: true,
      sortOrder: existing?.sortOrder ?? -100
    });
  };
  const handleDirectUploaded = async (result: { url: string; size: number; sha256: string; version: string }) => {
    setRelease((previous: any) => ({ ...previous, fileSize: formatFileSize(result.size), sha256: result.sha256, version: previous.version || result.version }));
    if (editingId) {
      try {
        await writeDirectMirror(editingId, result.url, release.mirrors);
        setDirectNotice({ text: '直链镜像已更新到当前编辑的版本。' });
        await reload();
      } catch (reason) {
        setDirectNotice({ text: `直链镜像写入失败：${reason instanceof Error ? reason.message : String(reason)}`, error: true });
      }
    } else {
      setPendingDirectUrl(result.url);
      setDirectNotice({ text: '文件已上传；保存版本后将自动写入“直链”镜像。' });
    }
  };
  return <div className="downloads-layout">
    <RecordPanel title="下载版本列表" empty="尚未创建下载版本，请先在右侧填写版本信息。">{releases.map((item: any) => { const mirrors = item.mirrors || []; return (
      <article className="site-record download-record" key={item.id}>
        <div><strong>{item.title}</strong><span>v{item.version} · {statusLabel(item.channel)} · {item.platform} {item.architecture}</span><small>{mirrors.length} 个镜像</small></div>
        <span className={`badge badge-${String(item.publicationStatus || 'DRAFT').toLowerCase()}`}>{statusLabel(item.publicationStatus)}</span>
        <button className={editingId === item.id ? 'active' : ''} onClick={() => { setRelease({ ...item }); setEditingId(item.id); setPendingDirectUrl(''); setDirectNotice(null); }}>编辑版本</button>
        <div className="download-mirrors">
          <div className="download-mirrors-head"><span>网盘镜像</span><button onClick={() => openMirror(item.id)}>＋ 添加镜像</button></div>
          {mirrors.length > 0 && <div className="download-mirrors-list">{mirrors.map((entry: any) => <button key={entry.id} className={`${entry.enabled ? '' : 'off '}${expandedReleaseId === item.id && mirrorDraft?.provider === entry.provider ? 'active' : ''}`} onClick={() => openMirror(item.id, entry)}>{entry.label}{entry.enabled ? '' : '（已停用）'}</button>)}</div>}
          {expandedReleaseId === item.id && mirrorDraft && <MirrorEditor value={mirrorDraft} setValue={setMirrorDraft} onCancel={closeMirror} onSubmit={async value => { await post(request, '/v1/admin/site/download-mirrors', value); await reload(); closeMirror(); }}/>}
        </div>
      </article>); })}</RecordPanel>
    <EditorPanel title={editingId ? `编辑下载版本 v${release.version}` : '新建下载版本'} description="相同版本、渠道、平台和架构会更新原记录；网盘镜像直接在左侧版本卡片内管理，无需再单独选择所属版本。">
      <DirectUploadPanel key={`${editingId || 'new'}-${uploadEpoch}`} request={request} notice={directNotice} onNotice={setDirectNotice} onUploaded={handleDirectUploaded}/>
      <ManagedForm value={release} setValue={setRelease} fields={[
        field('version','版本号'),field('title','下载标题'),field('channel','渠道','select',['preview','stable']),field('platform','平台'),field('architecture','架构'),field('summary','简要说明','textarea'),field('releaseNotes','更新说明','textarea'),field('minimumRequirements','环境要求','textarea'),field('fileSize','文件大小'),field('sha256','SHA-256'),field('publicationStatus','发布状态','select',statuses),field('sortOrder','排序','number')
      ]} onSubmit={async value => {
        const saved = await post(request, '/v1/admin/site/downloads', value);
        let mirrorNote = '';
        if (pendingDirectUrl && saved.release?.id) {
          const known = releases.find((item: any) => item.id === saved.release.id);
          try {
            await writeDirectMirror(saved.release.id, pendingDirectUrl, known?.mirrors);
            mirrorNote = '版本已保存，直链镜像已写入。';
          } catch (reason) {
            throw new Error(`版本已保存，但直链镜像写入失败：${reason instanceof Error ? reason.message : String(reason)}`);
          }
        }
        await reload(); startNewRelease();
        if (mirrorNote) setDirectNotice({ text: mirrorNote });
      }}/>
      {editingId && <div className="editor-reset"><button onClick={startNewRelease}>放弃当前编辑，返回新建版本</button></div>}
    </EditorPanel>
  </div>;
}

export function DirectUploadPanel({ request, notice, onNotice, onUploaded, description }: { request: Request; notice: DirectNotice; onNotice: (value: DirectNotice) => void; onUploaded: (result: { url: string; size: number; sha256: string; version: string }) => void | Promise<void>; description?: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [sha256, setSha256] = useState('');
  const [hashing, setHashing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [phase, setPhase] = useState('');
  const [progress, setProgress] = useState({ loaded: 0, total: 1 });
  const [error, setError] = useState('');
  const [doneUrl, setDoneUrl] = useState('');
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [uploadConfig, setUploadConfig] = useState<{ endpoint: string; token: string } | null>(null);
  const uploaderRef = useRef<R2MultipartUploader | null>(null);
  const startedAtRef = useRef(0);
  const progressFrame = useRef(0);
  const pendingProgress = useRef<{ loaded: number; total: number } | null>(null);

  useEffect(() => () => { if (progressFrame.current) cancelAnimationFrame(progressFrame.current); }, []);
  useEffect(() => {
    if (!uploading) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    globalThis.addEventListener('beforeunload', guard);
    return () => globalThis.removeEventListener('beforeunload', guard);
  }, [uploading]);

  const scheduleProgress = (loaded: number, total: number) => {
    pendingProgress.current = { loaded, total };
    if (progressFrame.current) return;
    progressFrame.current = requestAnimationFrame(() => {
      progressFrame.current = 0;
      if (pendingProgress.current) setProgress(pendingProgress.current);
    });
  };

  const clearFile = () => { setFile(null); setSha256(''); setDoneUrl(''); setError(''); setPhase(''); setCopied(false); };

  const selectFile = (next?: File | null) => {
    if (!next || uploading || hashing) return;
    setFile(next);
    setSha256('');
    setDoneUrl('');
    setError('');
    setPhase('');
    setCopied(false);
    setProgress({ loaded: 0, total: next.size });
    onNotice(null);
    setHashing(true);
    computeFileSha256Hex(next).then(setSha256, reason => setError(`SHA-256 计算失败：${reason instanceof Error ? reason.message : String(reason)}`)).finally(() => setHashing(false));
  };

  const ensureConfig = async () => {
    if (uploadConfig) return uploadConfig;
    const config = await request('/v1/admin/site/r2-upload/config');
    setUploadConfig(config);
    return config;
  };

  const startUpload = async () => {
    if (!file || uploading || hashing || !sha256) return;
    setError('');
    setDoneUrl('');
    try {
      const config = await ensureConfig();
      const uploader = new R2MultipartUploader({ baseUrl: config.endpoint, token: config.token, concurrency: 3, onProgress: scheduleProgress, onPhase: setPhase });
      uploaderRef.current = uploader;
      startedAtRef.current = performance.now();
      setUploading(true);
      setProgress({ loaded: 0, total: file.size });
      const result = await uploader.upload(file);
      const url = result.publicDownloadUrl || result.downloadUrl;
      setDoneUrl(url);
      setPhase('上传完成');
      await onUploaded({ url, size: file.size, sha256, version: versionFromFileName(file.name) });
    } catch (reason) {
      if (reason instanceof UploadCancelledError) setPhase('上传已取消');
      else { setError(reason instanceof Error ? reason.message : String(reason)); setPhase('上传失败'); }
    } finally {
      setUploading(false);
      uploaderRef.current = null;
    }
  };

  const cancelUpload = async () => {
    if (!uploaderRef.current) return;
    setPhase('正在取消...');
    await uploaderRef.current.cancel();
  };

  const copyUrl = async () => {
    if (!doneUrl) return;
    try { await navigator.clipboard.writeText(doneUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setError('复制失败，请手动选中地址复制。'); }
  };

  const percent = progress.total > 0 ? Math.min(100, Math.round((progress.loaded / progress.total) * 1000) / 10) : 0;
  const elapsedSeconds = Math.max((performance.now() - startedAtRef.current) / 1000, 0.001);
  const speed = startedAtRef.current > 0 && progress.loaded > 0 ? progress.loaded / elapsedSeconds : 0;
  const remainingSeconds = speed > 0 && percent < 100 ? (progress.total - progress.loaded) / speed : Number.NaN;

  return <section className="direct-upload" aria-labelledby="direct-upload-heading">
    <div className="direct-upload-head">
      <h3 id="direct-upload-heading"><CloudUpload size={15}/>直链上传</h3>
      <p>{description ?? '浏览器分片直传 Cloudflare R2，不占用官网服务器带宽；完成后自动填写文件大小、SHA-256 和版本号，并写入“直链”镜像。'}</p>
    </div>
    {notice && <p className={`direct-upload-notice${notice.error ? ' error' : ''}`} role="status">{notice.text}</p>}
    {!file && <label className={`direct-upload-drop${dragging ? ' dragging' : ''}`}
      onDragOver={event => { event.preventDefault(); if (!uploading) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={event => { event.preventDefault(); setDragging(false); selectFile(event.dataTransfer.files?.[0]); }}>
      <input type="file" onChange={event => { selectFile(event.target.files?.[0]); event.target.value = ''; }}/>
      <CloudUpload size={24}/>
      <strong>拖拽安装包到此处，或点击选择文件</strong>
      <span>32 MiB 分片 · 3 路并发 · 失败自动重试</span>
    </label>}
    {file && <div className="direct-upload-body">
      <div className="direct-upload-file">
        <FileArchive size={18}/>
        <div>
          <strong title={file.name}>{file.name}</strong>
          <span>{formatFileSize(file.size)} · {hashing ? '正在计算 SHA-256…' : sha256 ? `SHA-256 ${sha256.slice(0, 12)}…` : 'SHA-256 未计算'}</span>
        </div>
        {!uploading && !doneUrl && <button type="button" onClick={clearFile}>移除</button>}
      </div>
      {(uploading || phase) && <div className="direct-upload-progress">
        <div className="direct-upload-progress-row">
          <p className="direct-upload-phase" aria-live="polite">{phase || '准备上传...'}</p>
          <strong className="direct-upload-percent">{percent}%</strong>
        </div>
        <div className="direct-upload-bar" role="progressbar" aria-label="文件上传进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{ width: `${percent}%` }}/></div>
        <div className="direct-upload-stats">
          <span>{formatFileSize(progress.loaded)} / {formatFileSize(progress.total)}</span>
          {uploading && speed > 0 && <span>{formatFileSize(speed)}/s</span>}
          {uploading && Number.isFinite(remainingSeconds) && <span>剩余 {formatUploadDuration(remainingSeconds)}</span>}
        </div>
      </div>}
      {error && <p className="direct-upload-error" role="alert">{error}{!uploading && <button type="button" onClick={() => void startUpload()}>重试</button>}</p>}
      {doneUrl && <div className="direct-upload-done">
        <span>上传完成，直链下载地址：</span>
        <a href={doneUrl} target="_blank" rel="noreferrer">{doneUrl}</a>
      </div>}
      <div className="direct-upload-actions">
        {!doneUrl && <button type="button" className="primary" disabled={uploading || hashing || !sha256} onClick={() => void startUpload()}>{uploading ? '正在上传…' : hashing ? '正在计算 SHA-256…' : '开始上传'}</button>}
        {uploading && <button type="button" onClick={() => void cancelUpload()}>取消上传</button>}
        {!uploading && doneUrl && <button type="button" onClick={() => void copyUrl()}>{copied ? '已复制' : '复制地址'}</button>}
        {!uploading && doneUrl && <button type="button" onClick={clearFile}>上传新文件</button>}
      </div>
    </div>}
  </section>;
}

function formatUploadDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '--';
  if (seconds < 60) return `${Math.ceil(seconds)} 秒`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟`;
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`;
}

function MirrorEditor({ value, setValue, onCancel, onSubmit }: { value:any; setValue:(value:any)=>void; onCancel:()=>void; onSubmit:(value:any)=>Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); setMessage(''); try { await onSubmit(value); } catch (reason) { setMessage(reason instanceof Error ? reason.message : String(reason)); } finally { setBusy(false); } };
  return <form className="mirror-editor" onSubmit={submit}>
    <p className="mirror-editor-title">网盘镜像设置<span>同一版本内镜像标识相同时更新原镜像；停用后官网不再展示</span></p>
    <div className="mirror-editor-grid">
      <label><span>镜像标识</span><input required value={value.provider ?? ''} onChange={event => setValue({ ...value, provider: event.target.value })} placeholder="如 123pan、tianyi、baidu"/></label>
      <label><span>显示名称</span><input required value={value.label ?? ''} onChange={event => setValue({ ...value, label: event.target.value })} placeholder="如 123 云盘"/></label>
      <label className="wide"><span>下载地址</span><input required type="url" value={value.url ?? ''} onChange={event => setValue({ ...value, url: event.target.value })} placeholder="https://…"/></label>
      <label><span>提取码</span><input value={value.accessCode ?? ''} onChange={event => setValue({ ...value, accessCode: event.target.value })}/></label>
      <label><span>排序</span><input type="number" value={value.sortOrder ?? 0} onChange={event => setValue({ ...value, sortOrder: Number(event.target.value) })}/></label>
      <label className="check"><input type="checkbox" checked={value.enabled !== false} onChange={event => setValue({ ...value, enabled: event.target.checked })}/><span>在官网展示该镜像</span></label>
    </div>
    <div className="mirror-editor-actions"><button type="button" onClick={onCancel}>取消</button><button className="primary" disabled={busy}>{busy ? '正在保存…' : '保存镜像'}</button>{message && <span className="form-message form-message-error" role="status">{message}</span>}</div>
  </form>;
}

function CommandsAdmin({ data, request, reload }: AdminProps) {
  const commands = data?.commands || [];
  const [query, setQuery] = useState('');
  const [command, setCommand] = useState<any>(emptyCommand());
  const [syncMessage, setSyncMessage] = useState('');
  const filtered = useMemo(() => commands.filter((item:any) => JSON.stringify(item).toLowerCase().includes(query.toLowerCase())), [commands, query]);
  const importManifest = async (file?: File) => {
    if (!file) return;
    setSyncMessage('正在读取模块清单…');
    try {
      const parsed = JSON.parse(await file.text());
      const manifests = Array.isArray(parsed) ? parsed : [parsed];
      let updated = 0; let deprecated = 0;
      for (const manifest of manifests) { const result = await post(request, '/v1/admin/site/commands/sync-manifest', { manifest, publish: true }); updated += result.updated; deprecated += result.deprecated; }
      setSyncMessage(`同步完成：更新 ${updated} 条，标记废弃 ${deprecated} 条。`); await reload();
    } catch (reason) { setSyncMessage(reason instanceof Error ? reason.message : String(reason)); }
  };
  return <div className="site-admin-grid"><EditorPanel title="同步模块命令" description="导入单个 manifest v2 或 manifest 数组；同一模块的旧命令会更新，不再存在的命令会标记为已废弃。"><label className="manifest-upload"><Upload/><strong>选择 lingbuilder.module.json</strong><span>导入后立即发布到命令查找</span><input type="file" accept="application/json,.json" onChange={event => void importManifest(event.target.files?.[0])}/></label>{syncMessage && <p className="form-message">{syncMessage}</p>}</EditorPanel>
    <EditorPanel title="手工补充命令资料" description="适合内置命令、事件、常量或需要补充说明的资料。"><ManagedForm value={command} setValue={setCommand} fields={[
      field('name','名称'),field('stableKey','稳定键'),field('kind','类型','select',['COMMAND','EVENT','CONSTANT','TYPE']),field('category','分类'),field('moduleId','模块 ID'),field('moduleName','模块名称'),field('signature','签名'),field('returnType','返回类型'),field('summary','说明','textarea'),field('parametersJson','参数 JSON','textarea'),field('examplesText','示例（每行一条）','textarea'),field('supportedBackendsText','适用目标（逗号分隔）'),field('minimumVersion','最低版本'),field('lifecycle','生命周期','select',['AVAILABLE','DEPRECATED']),field('publicationStatus','发布状态','select',statuses)
    ]} onSubmit={async value => { await post(request, '/v1/admin/site/commands', {...value, parameters: parseJsonArray(value.parametersJson,'参数 JSON'), examples: lines(value.examplesText), supportedBackends: csv(value.supportedBackendsText)}); await reload(); setCommand(emptyCommand()); }}/></EditorPanel>
    <RecordPanel title="命令资料" empty="尚无命令资料。" search={query} onSearch={setQuery}>{filtered.map((item:any) => <article className="site-record" key={item.id}><div><strong>{item.name}</strong><span>{item.signature}</span><small>{item.moduleName || item.moduleId || '手工资料'} · {statusLabel(item.publicationStatus)} · {item.lifecycle}</small></div><button onClick={() => setCommand({...item,parametersJson:JSON.stringify(item.parameters,null,2),examplesText:(item.examples||[]).join('\n'),supportedBackendsText:(item.supportedBackends||[]).join(', ')})}>编辑</button></article>)}</RecordPanel>
  </div>;
}

function GuidesAdmin({ data, request, reload }: AdminProps) {
  const guides = data?.guides || [];
  const [guide, setGuide] = useState<any>(emptyGuide());
  return <div className="site-admin-grid"><EditorPanel title="编辑控件或教程文档" description="正文使用 Markdown；Slug 相同会更新原文章。"><ManagedForm value={guide} setValue={setGuide} fields={[
    field('slug','Slug'),field('title','标题'),field('kind','文档类型','select',['CONTROL','MODULE','AI']),field('category','分类'),field('summary','摘要','textarea'),field('bodyMarkdown','Markdown 正文','textarea-large'),field('tagsText','标签（逗号分隔）'),field('minimumVersion','最低版本'),field('coverImageUrl','封面地址'),field('publicationStatus','发布状态','select',statuses),field('sortOrder','排序','number')
  ]} onSubmit={async value => { await post(request, '/v1/admin/site/guides', {...value,tags:csv(value.tagsText)}); await reload(); setGuide(emptyGuide()); }}/></EditorPanel><RecordPanel title="现有文档" empty="尚无官网文档。">{guides.map((item:any) => <article className="site-record" key={item.id}><div><strong>{item.title}</strong><span>{item.kind} · {item.category}</span><small>/{item.slug} · {statusLabel(item.publicationStatus)}</small></div><button onClick={() => setGuide({...item,tagsText:(item.tags||[]).join(', ')})}>编辑</button></article>)}</RecordPanel></div>;
}

const DEMO_PACKAGE_LABEL = '下载源码包';

function DemosAdmin({ data, request, reload }: AdminProps) {
  const demos = data?.demos || [];
  const [demo, setDemo] = useState<any>(emptyDemo());
  const [editingId, setEditingId] = useState('');
  const slug = String(demo.slug || '').trim().toLowerCase();
  const slugReady = /^[a-z0-9][a-z0-9-]{1,99}$/u.test(slug);
  const blockedReason = slugReady ? '' : '请先填写 Slug（小写字母、数字和连字符），上传的文件会用它命名。';
  const links: any[] = Array.isArray(demo.sourceLinks) ? demo.sourceLinks : [];
  const packageLink = links.find(item => String(item?.label || '').startsWith(DEMO_PACKAGE_LABEL));
  const startNewDemo = () => { setDemo(emptyDemo()); setEditingId(''); };
  const applyPackage = ({ url, file }: { url: string; file: File }) => setDemo((previous: any) => ({
    ...previous,
    sourceLinks: [{ label: `${DEMO_PACKAGE_LABEL}（${formatFileSize(file.size)}）`, url }, ...(previous.sourceLinks || []).filter((item: any) => !String(item?.label || '').startsWith(DEMO_PACKAGE_LABEL))]
  }));
  return <div className="site-admin-grid">
    <EditorPanel title={editingId ? `编辑示例：${demo.title || slug}` : '新建示例 Demo'} description="填好 Slug 之后直接把源码包和截图拖进来上传，不需要手写链接；说明和运行要求在下方表单里填写。">
      <div className="asset-uploads">
        <AssetUpload key={`${editingId || 'new'}-package`} request={request} icon={FileArchive} title="上传源码包" hint="ZIP / 7Z / RAR 均可；浏览器分片直传，完成后自动生成“下载源码包”地址。" accept=".zip,.7z,.rar,application/zip,application/x-7z-compressed" fileNamePrefix={`demo-${slug || 'draft'}`} blockedReason={blockedReason} onUploaded={applyPackage}>
          {packageLink && <p className="asset-upload-done">已关联源码包：<a href={packageLink.url} target="_blank" rel="noreferrer">{packageLink.label}</a></p>}
        </AssetUpload>
        <AssetUpload key={`${editingId || 'new'}-shot`} request={request} icon={ImageIcon} title="上传运行截图" hint="PNG / JPG / WebP；上传后自动填写截图地址，并展示在官网示例卡片上。" accept="image/*" fileNamePrefix={`demo-${slug || 'draft'}-shot`} blockedReason={blockedReason} onUploaded={({ url }) => setDemo((previous: any) => ({ ...previous, screenshotUrl: url }))}>
          {demo.screenshotUrl && <div className="asset-upload-preview"><img src={demo.screenshotUrl} alt="示例运行截图预览"/><button type="button" onClick={() => setDemo((previous: any) => ({ ...previous, screenshotUrl: '' }))}>移除截图</button></div>}
        </AssetUpload>
      </div>
      <SourceLinkEditor links={links} onChange={value => setDemo((previous: any) => ({ ...previous, sourceLinks: value }))}/>
      <ManagedForm value={demo} setValue={setDemo} fields={[
        field('slug','Slug'),field('title','标题'),field('category','分类'),field('difficulty','难度','select',['入门','进阶','高级']),field('summary','说明','textarea'),field('lingBuilderVersion','IDE 版本'),field('modulesText','所需模块（逗号分隔）'),field('prerequisites','运行要求','textarea'),field('videoUrl','视频地址'),field('license','许可证'),field('publicationStatus','发布状态','select',statuses),field('sortOrder','排序','number')
      ]} onSubmit={async value => {
        const sourceLinks = (value.sourceLinks || []).map((item: any) => ({ label: String(item?.label || '').trim() || DEMO_PACKAGE_LABEL, url: String(item?.url || '').trim() })).filter((item: any) => item.url);
        if (!sourceLinks.length) throw new Error('请先上传源码包，或在“源码下载地址”里手工填写至少一个地址。');
        await post(request, '/v1/admin/site/demos', { ...value, modules: csv(value.modulesText), sourceLinks });
        await reload(); startNewDemo();
      }}/>
      {editingId && <div className="editor-reset"><button onClick={startNewDemo}>放弃当前编辑，返回新建示例</button></div>}
    </EditorPanel>
    <RecordPanel title="示例项目" empty="尚无示例项目。">{demos.map((item:any) => <article className="site-record" key={item.id}>{item.screenshotUrl && <img className="demo-record-shot" src={item.screenshotUrl} alt=""/>}<div><strong>{item.title}</strong><span>{item.category} · {item.difficulty}</span><small>{item.modules.length} 个模块 · {(item.sourceLinks || []).length} 个下载地址 · {statusLabel(item.publicationStatus)}</small></div><button className={editingId === item.id ? 'active' : ''} onClick={() => { setDemo({ ...item, modulesText: (item.modules || []).join(', '), sourceLinks: Array.isArray(item.sourceLinks) ? item.sourceLinks : [] }); setEditingId(item.id); }}>编辑</button></article>)}</RecordPanel>
  </div>;
}

/** 示例源码包与截图的单文件直传：选中即上传，完成后把公开地址回填到示例记录。 */
function AssetUpload({ request, icon: Icon, title, hint, accept, fileNamePrefix, blockedReason, onUploaded, children }: { request: Request; icon: typeof CloudUpload; title: string; hint: string; accept: string; fileNamePrefix: string; blockedReason: string; onUploaded: (result: { url: string; file: File }) => void; children?: React.ReactNode }) {
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [phase, setPhase] = useState('');
  const [progress, setProgress] = useState({ loaded: 0, total: 1 });
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const uploaderRef = useRef<R2MultipartUploader | null>(null);
  useEffect(() => {
    if (!uploading) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    globalThis.addEventListener('beforeunload', guard);
    return () => globalThis.removeEventListener('beforeunload', guard);
  }, [uploading]);
  const start = async (file?: File | null) => {
    if (!file || uploading) return;
    setError(''); setPhase(''); setFileName(file.name);
    if (blockedReason) { setError(blockedReason); return; }
    setProgress({ loaded: 0, total: file.size });
    try {
      const config = await request('/v1/admin/site/r2-upload/config');
      const named = new File([file], `${fileNamePrefix}-${file.name}`, { type: file.type || 'application/octet-stream' });
      const uploader = new R2MultipartUploader({ baseUrl: config.endpoint, token: config.token, concurrency: 3, onProgress: (loaded, total) => setProgress({ loaded, total }), onPhase: setPhase });
      uploaderRef.current = uploader;
      setUploading(true);
      const result = await uploader.upload(named);
      const base = result.publicDownloadUrl || result.downloadUrl;
      setPhase('上传完成');
      onUploaded({ url: `${base}${base.includes('?') ? '&' : '?'}v=${Date.now().toString(36)}`, file });
    } catch (reason) {
      if (reason instanceof UploadCancelledError) setPhase('上传已取消');
      else { setError(reason instanceof Error ? reason.message : String(reason)); setPhase(''); }
    } finally { setUploading(false); uploaderRef.current = null; }
  };
  const percent = progress.total > 0 ? Math.min(100, Math.round((progress.loaded / progress.total) * 1000) / 10) : 0;
  return <section className="asset-upload">
    <div className="asset-upload-head"><h3><Icon size={15}/>{title}</h3><p>{hint}</p></div>
    <label className={`asset-upload-drop${dragging ? ' dragging' : ''}${uploading ? ' busy' : ''}`}
      onDragOver={event => { event.preventDefault(); if (!uploading) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={event => { event.preventDefault(); setDragging(false); void start(event.dataTransfer.files?.[0]); }}>
      <input type="file" accept={accept} disabled={uploading} onChange={event => { const picked = event.target.files?.[0]; event.target.value = ''; void start(picked); }}/>
      <CloudUpload size={20}/>
      <strong>{uploading ? fileName : '拖拽文件到此处，或点击选择'}</strong>
      <span>{uploading ? '正在上传，请勿关闭页面' : '选中后立即上传'}</span>
    </label>
    {(uploading || phase) && <div className="direct-upload-progress">
      <div className="direct-upload-progress-row"><p className="direct-upload-phase" aria-live="polite">{phase || '准备上传…'}</p><strong className="direct-upload-percent">{percent}%</strong></div>
      <div className="direct-upload-bar" role="progressbar" aria-label={`${title}进度`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{ width: `${percent}%` }}/></div>
      {uploading && <div className="direct-upload-actions"><button type="button" onClick={() => void uploaderRef.current?.cancel()}>取消上传</button></div>}
    </div>}
    {error && <p className="direct-upload-error" role="alert">{error}</p>}
    {children}
  </section>;
}

function SourceLinkEditor({ links, onChange }: { links: any[]; onChange: (value: any[]) => void }) {
  const update = (index: number, patch: any) => onChange(links.map((item, current) => current === index ? { ...item, ...patch } : item));
  return <section className="link-editor">
    <div className="link-editor-head"><h3><Link2 size={15}/>源码下载地址</h3><button type="button" onClick={() => onChange([...links, { label: '', url: '' }])}>＋ 手工添加地址</button></div>
    {links.length === 0
      ? <p className="link-editor-empty">还没有下载地址：上传源码包后会自动生成，也可以手工添加站内路径或 HTTP/HTTPS 地址（例如网盘链接）。</p>
      : <div className="link-editor-rows">{links.map((item, index) => <div className="link-editor-row" key={index}>
        <input aria-label={`第 ${index + 1} 个地址的显示名称`} value={item?.label ?? ''} onChange={event => update(index, { label: event.target.value })} placeholder="显示名称，如 网盘备用下载"/>
        <input aria-label={`第 ${index + 1} 个下载地址`} value={item?.url ?? ''} onChange={event => update(index, { url: event.target.value })} placeholder="https://… 或 /examples/…"/>
        <button type="button" onClick={() => onChange(links.filter((_, current) => current !== index))}>删除</button>
      </div>)}</div>}
  </section>;
}

function GroupsAdmin({ data, request, reload }: AdminProps) {
  const groups = data?.groups || [];
  const [group, setGroup] = useState<any>(emptyGroup());
  return <div className="site-admin-grid"><EditorPanel title="编辑 QQ 交流群" description="群号相同会更新原记录；关闭启用后官网不再展示。"><ManagedForm value={group} setValue={setGroup} fields={[
    field('name','群名称'),field('qqNumber','QQ群号'),field('groupType','群类型'),field('statusText','状态文字'),field('description','群说明','textarea'),field('joinUrl','加群链接'),field('qrCodeUrl','二维码地址'),field('enabled','启用','checkbox'),field('sortOrder','排序','number')
  ]} onSubmit={async value => { await post(request, '/v1/admin/site/community-groups', value); await reload(); setGroup(emptyGroup()); }}/></EditorPanel><RecordPanel title="交流群" empty="尚未配置交流群。">{groups.map((item:any) => <article className="site-record" key={item.id}><div><strong>{item.name}</strong><span>{item.qqNumber} · {item.groupType}</span><small>{item.enabled ? item.statusText : '已停用'}</small></div><button onClick={() => setGroup({...item})}>编辑</button></article>)}</RecordPanel></div>;
}

/** 赞助名单：一笔赞助一条记录（同一 QQ 可多笔），官网 /sponsors 按赞助时间先后展示；金额按元录入、以分存储。 */
function SponsorsAdmin({ data, request, reload }: AdminProps) {
  const sponsors = data?.sponsors || [];
  const [sponsor, setSponsor] = useState<any>(emptySponsor());
  const [editingId, setEditingId] = useState('');
  const [message, setMessage] = useState('');
  const startNew = () => { setSponsor(emptySponsor()); setEditingId(''); setMessage(''); };
  const submit = async (value: any) => {
    await post(request, '/v1/admin/site/sponsors', { ...value, id: editingId || undefined });
    await reload(); startNew();
  };
  const edit = (item: any) => { setSponsor({ ...item, amountYuan: item.amountCents / 100, sponsoredAt: toLocalInputValue(item.sponsoredAt) }); setEditingId(item.id); setMessage(''); };
  const remove = async (item: any) => {
    if (!window.confirm(`确定删除 ${item.qqNumber} 的这笔赞助记录？删除会写入管理员审计日志。`)) return;
    setMessage('');
    try {
      await request(`/v1/admin/site/sponsors/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
      if (editingId === item.id) startNew();
      await reload();
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : String(reason)); }
  };
  return <div className="site-admin-grid">
    <EditorPanel title={editingId ? '编辑赞助记录' : '登记赞助记录'} description="金额按元填写，支持两位小数；赞助时间决定官网列表的排序（时间先后）。关闭启用后官网不再展示该条。">
      <ManagedForm value={sponsor} setValue={setSponsor} fields={[
        field('qqNumber','QQ号'),field('amountYuan','赞助金额（元）','number'),field('sponsoredAt','赞助时间','datetime'),field('enabled','在官网展示','checkbox')
      ]} onSubmit={submit}/>
      {editingId && <div className="editor-reset"><button onClick={startNew}>放弃当前编辑，返回新建记录</button></div>}
    </EditorPanel>
    <RecordPanel title="赞助记录" empty="尚无赞助记录。">{sponsors.map((item: any) => <article className="site-record" key={item.id}>
      <div><strong>{item.qqNumber}</strong><span>¥{(item.amountCents / 100).toFixed(2)} · {new Date(item.sponsoredAt).toLocaleDateString('zh-CN')}</span><small>{item.enabled ? '展示中' : '已隐藏'}</small></div>
      <div className="site-record-actions"><button className={editingId === item.id ? 'active' : ''} onClick={() => edit(item)}>编辑</button><button onClick={() => void remove(item)}>删除</button></div>
    </article>)}</RecordPanel>
    {message && <p className="form-message form-message-error" role="alert">{message}</p>}
  </div>;
}

function ManagedForm({ value, setValue, fields, onSubmit }: { value:any; setValue:(value:any)=>void; fields:Field[]; onSubmit:(value:any)=>Promise<void> }) {
  const [busy,setBusy] = useState(false); const [message,setMessage] = useState('');
  const submit = async (event:React.FormEvent) => { event.preventDefault(); setBusy(true); setMessage(''); try { await onSubmit(value); setMessage('保存成功。'); } catch (reason) { setMessage(reason instanceof Error ? reason.message : String(reason)); } finally { setBusy(false); } };
  return <form className="managed-form" onSubmit={submit}>{fields.map(item => <label key={item.name} className={item.type === 'textarea-large' ? 'wide' : ''}><span>{item.label}</span>{renderInput(item,value[item.name],next => setValue({...value,[item.name]:next}))}</label>)}<div className="managed-actions"><button className="primary" disabled={busy}>{busy?'正在保存…':'保存内容'}</button>{message&&<span className="form-message" role="status">{message}</span>}</div></form>;
}

function renderInput(item:Field,value:any,onChange:(value:any)=>void) {
  if(item.type==='select') return <select required value={value ?? ''} onChange={event=>onChange(event.target.value)}>{optionValues(item.options).map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select>;
  if(item.type==='checkbox') return <input type="checkbox" checked={value !== false} onChange={event=>onChange(event.target.checked)}/>;
  if(item.type==='datetime') return <input type="datetime-local" value={value ?? ''} onChange={event=>onChange(event.target.value)}/>;
  if(item.type==='textarea'||item.type==='textarea-large') return <textarea required={['summary','bodyMarkdown'].includes(item.name)} rows={item.type==='textarea-large'?18:5} value={value ?? ''} onChange={event=>onChange(event.target.value)}/>;
  return <input required={['version','title','name','slug','qqNumber','signature'].includes(item.name)} type={item.type==='number'?'number':'text'} value={value ?? ''} onChange={event=>onChange(item.type==='number'?Number(event.target.value):event.target.value)}/>;
}

function EditorPanel({title,description,children}:{title:string;description:string;children:React.ReactNode}) { return <section className="panel site-editor"><div className="panel-head"><div><h2>{title}</h2><p>{description}</p></div></div>{children}</section>; }
function RecordPanel({title,empty,children,search,onSearch}:{title:string;empty:string;children:React.ReactNode;search?:string;onSearch?:(value:string)=>void}) { const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children); return <section className="panel site-records"><div className="panel-head"><h2>{title}</h2>{onSearch&&<label className="search"><Search size={15}/><input value={search} onChange={event=>onSearch(event.target.value)} placeholder="筛选当前资料"/></label>}</div>{hasChildren?<div>{children}</div>:<div className="empty">{empty}</div>}</section>; }
function field(name:string,label:string,type:Field['type']='text',options?:Field['options']):Field { return {name,label,type,options}; }
function optionValues(options:Field['options']) { return (options||[]).map(item => typeof item === 'string' ? {value:item,label:statusLabel(item)} : item); }
async function post(request:Request,path:string,value:any) { return request(path,{method:'POST',body:JSON.stringify(value)}); }
function parseJsonArray(value:string,label:string){try{const parsed=JSON.parse(value||'[]');if(!Array.isArray(parsed))throw new Error();return parsed}catch{throw new Error(`${label}必须是 JSON 数组。`)}}
function csv(value:string){return String(value||'').split(/[,，\n]/u).map(item=>item.trim()).filter(Boolean)}
function lines(value:string){return String(value||'').split(/\r?\n/u).map(item=>item.trim()).filter(Boolean)}
function statusLabel(value:string){return ({DRAFT:'草稿',PUBLISHED:'已发布',ARCHIVED:'已归档',stable:'稳定版',preview:'预览版'} as Record<string,string>)[value]||value}
function countFor(section:Section,data:any){return ({downloads:(data?.downloads||[]).length,commands:(data?.commands||[]).length,guides:(data?.guides||[]).length,demos:(data?.demos||[]).length,groups:(data?.groups||[]).length,sponsors:(data?.sponsors||[]).length} as Record<Section,number>)[section]||0}
function emptyRelease(){return {version:'',channel:'preview',platform:'Windows',architecture:'x64',title:'LingBuilder 中文集成开发环境',summary:'',releaseNotes:'',minimumRequirements:'Windows 10/11',fileSize:'',sha256:'',publicationStatus:'DRAFT',sortOrder:0}}
function emptyCommand(){return {name:'',stableKey:'',kind:'COMMAND',category:'其他',moduleId:'',moduleName:'',signature:'',returnType:'void',summary:'',parametersJson:'[]',examplesText:'',supportedBackendsText:'',minimumVersion:'',lifecycle:'AVAILABLE',publicationStatus:'DRAFT'}}
function emptyGuide(){return {slug:'',title:'',kind:'CONTROL',category:'',summary:'',bodyMarkdown:'# 标题\n\n开始编写正文。',tagsText:'',minimumVersion:'',coverImageUrl:'',publicationStatus:'DRAFT',sortOrder:0}}
function emptyDemo(){return {slug:'',title:'',category:'入门',difficulty:'入门',summary:'',lingBuilderVersion:'',modulesText:'',prerequisites:'',sourceLinks:[],screenshotUrl:'',videoUrl:'',license:'示例许可',publicationStatus:'DRAFT',sortOrder:0}}
function emptyGroup(){return {name:'LingBuilder 官方 QQ 交流群',qqNumber:'',groupType:'官方交流群',statusText:'开放加入',description:'',joinUrl:'',qrCodeUrl:'',enabled:true,sortOrder:0}}
function emptySponsor(){return {qqNumber:'',amountYuan:'',sponsoredAt:toLocalInputValue(new Date().toISOString()),enabled:true}}
/** ISO 时间转 datetime-local 输入值（本地时区 YYYY-MM-DDTHH:mm），编辑赞助时间时使用。 */
function toLocalInputValue(value:string){const date=new Date(value);if(Number.isNaN(date.getTime()))return '';const pad=(part:number)=>String(part).padStart(2,'0');return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`}
interface AdminProps { data:any; request:Request; reload:()=>Promise<void> }
interface Field { name:string; label:string; type:'text'|'number'|'select'|'checkbox'|'textarea'|'textarea-large'|'datetime'; options?:Array<string|{value:string;label:string}> }
const statuses=['DRAFT','PUBLISHED','ARCHIVED'];
