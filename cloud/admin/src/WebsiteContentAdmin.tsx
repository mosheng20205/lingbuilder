import { useMemo, useState } from 'react';
import { BookOpen, Download, FileCode2, Globe2, MessageCircle, PackagePlus, Search, Upload } from 'lucide-react';
import './website-admin.css';

type Request = (path: string, init?: RequestInit) => Promise<any>;
type Section = 'downloads' | 'commands' | 'guides' | 'demos' | 'groups';

const SECTIONS: Array<{id: Section; label: string; icon: typeof Globe2}> = [
  { id: 'downloads', label: '版本与下载', icon: Download },
  { id: 'commands', label: '命令资料', icon: Search },
  { id: 'guides', label: '控件与教程', icon: BookOpen },
  { id: 'demos', label: '示例源码', icon: FileCode2 },
  { id: 'groups', label: '交流群', icon: MessageCircle }
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
  </div>;
}

function DownloadsAdmin({ data, request, reload }: AdminProps) {
  const releases = data?.downloads || [];
  const [release, setRelease] = useState<any>(emptyRelease());
  const [mirror, setMirror] = useState<any>({ releaseId: releases[0]?.id || '', provider: '', label: '', url: '', accessCode: '', enabled: true, sortOrder: 0 });
  return <div className="site-admin-grid"><EditorPanel title="编辑下载版本" description="相同版本、渠道、平台和架构会更新原记录。"><ManagedForm value={release} setValue={setRelease} fields={[
    field('version','版本号'),field('title','下载标题'),field('channel','渠道','select',['preview','stable']),field('platform','平台'),field('architecture','架构'),field('summary','简要说明','textarea'),field('releaseNotes','更新说明','textarea'),field('minimumRequirements','环境要求','textarea'),field('fileSize','文件大小'),field('sha256','SHA-256'),field('publicationStatus','发布状态','select',statuses),field('sortOrder','排序','number')
  ]} onSubmit={async value => { await post(request, '/v1/admin/site/downloads', value); await reload(); setRelease(emptyRelease()); }}/></EditorPanel>
    <EditorPanel title="编辑下载镜像" description="网盘地址和提取码可以单独更新，无需重新发布官网。"><ManagedForm value={{...mirror, releaseId: mirror.releaseId || releases[0]?.id || ''}} setValue={setMirror} fields={[
      field('releaseId','所属版本','select',releases.map((item:any) => ({value:item.id,label:`${item.version} · ${item.channel}`}))),field('provider','镜像标识'),field('label','显示名称'),field('url','下载地址'),field('accessCode','提取码'),field('enabled','启用','checkbox'),field('sortOrder','排序','number')
    ]} onSubmit={async value => { await post(request, '/v1/admin/site/download-mirrors', value); await reload(); setMirror({...mirror, provider:'',label:'',url:'',accessCode:''}); }}/></EditorPanel>
    <RecordPanel title="现有下载版本" empty="尚未创建下载版本。">{releases.map((item:any) => <article className="site-record" key={item.id}><div><strong>{item.title}</strong><span>v{item.version} · {item.channel} · {item.platform} {item.architecture}</span><small>{item.mirrors.length} 个镜像 · {statusLabel(item.publicationStatus)}</small></div><button onClick={() => setRelease({...item})}>编辑版本</button>{item.mirrors.map((entry:any) => <button key={entry.id} onClick={() => setMirror({...entry})}>{entry.label}</button>)}</article>)}</RecordPanel>
  </div>;
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

function DemosAdmin({ data, request, reload }: AdminProps) {
  const demos = data?.demos || [];
  const [demo, setDemo] = useState<any>(emptyDemo());
  return <div className="site-admin-grid"><EditorPanel title="编辑示例 Demo" description="每个示例至少提供一个源码链接；站内路径和 HTTP/HTTPS 地址均可。"><ManagedForm value={demo} setValue={setDemo} fields={[
    field('slug','Slug'),field('title','标题'),field('category','分类'),field('difficulty','难度','select',['入门','进阶','高级']),field('summary','说明','textarea'),field('lingBuilderVersion','IDE 版本'),field('modulesText','所需模块（逗号分隔）'),field('prerequisites','运行要求','textarea'),field('sourceLinksJson','源码链接 JSON','textarea'),field('screenshotUrl','截图地址'),field('videoUrl','视频地址'),field('license','许可证'),field('publicationStatus','发布状态','select',statuses),field('sortOrder','排序','number')
  ]} onSubmit={async value => { await post(request, '/v1/admin/site/demos', {...value,modules:csv(value.modulesText),sourceLinks:parseJsonArray(value.sourceLinksJson,'源码链接 JSON')}); await reload(); setDemo(emptyDemo()); }}/></EditorPanel><RecordPanel title="示例项目" empty="尚无示例项目。">{demos.map((item:any) => <article className="site-record" key={item.id}><div><strong>{item.title}</strong><span>{item.category} · {item.difficulty}</span><small>{item.modules.length} 个模块 · {statusLabel(item.publicationStatus)}</small></div><button onClick={() => setDemo({...item,modulesText:(item.modules||[]).join(', '),sourceLinksJson:JSON.stringify(item.sourceLinks,null,2)})}>编辑</button></article>)}</RecordPanel></div>;
}

function GroupsAdmin({ data, request, reload }: AdminProps) {
  const groups = data?.groups || [];
  const [group, setGroup] = useState<any>(emptyGroup());
  return <div className="site-admin-grid"><EditorPanel title="编辑 QQ 交流群" description="群号相同会更新原记录；关闭启用后官网不再展示。"><ManagedForm value={group} setValue={setGroup} fields={[
    field('name','群名称'),field('qqNumber','QQ群号'),field('groupType','群类型'),field('statusText','状态文字'),field('description','群说明','textarea'),field('joinUrl','加群链接'),field('qrCodeUrl','二维码地址'),field('enabled','启用','checkbox'),field('sortOrder','排序','number')
  ]} onSubmit={async value => { await post(request, '/v1/admin/site/community-groups', value); await reload(); setGroup(emptyGroup()); }}/></EditorPanel><RecordPanel title="交流群" empty="尚未配置交流群。">{groups.map((item:any) => <article className="site-record" key={item.id}><div><strong>{item.name}</strong><span>{item.qqNumber} · {item.groupType}</span><small>{item.enabled ? item.statusText : '已停用'}</small></div><button onClick={() => setGroup({...item})}>编辑</button></article>)}</RecordPanel></div>;
}

function ManagedForm({ value, setValue, fields, onSubmit }: { value:any; setValue:(value:any)=>void; fields:Field[]; onSubmit:(value:any)=>Promise<void> }) {
  const [busy,setBusy] = useState(false); const [message,setMessage] = useState('');
  const submit = async (event:React.FormEvent) => { event.preventDefault(); setBusy(true); setMessage(''); try { await onSubmit(value); setMessage('保存成功。'); } catch (reason) { setMessage(reason instanceof Error ? reason.message : String(reason)); } finally { setBusy(false); } };
  return <form className="managed-form" onSubmit={submit}>{fields.map(item => <label key={item.name} className={item.type === 'textarea-large' ? 'wide' : ''}><span>{item.label}</span>{renderInput(item,value[item.name],next => setValue({...value,[item.name]:next}))}</label>)}<div className="managed-actions"><button className="primary" disabled={busy}>{busy?'正在保存…':'保存内容'}</button>{message&&<span className="form-message" role="status">{message}</span>}</div></form>;
}

function renderInput(item:Field,value:any,onChange:(value:any)=>void) {
  if(item.type==='select') return <select required value={value ?? ''} onChange={event=>onChange(event.target.value)}>{optionValues(item.options).map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select>;
  if(item.type==='checkbox') return <input type="checkbox" checked={value !== false} onChange={event=>onChange(event.target.checked)}/>;
  if(item.type==='textarea'||item.type==='textarea-large') return <textarea required={['summary','bodyMarkdown','sourceLinksJson'].includes(item.name)} rows={item.type==='textarea-large'?18:5} value={value ?? ''} onChange={event=>onChange(event.target.value)}/>;
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
function countFor(section:Section,data:any){return section==='downloads'?(data?.downloads||[]).length:section==='commands'?(data?.commands||[]).length:section==='guides'?(data?.guides||[]).length:section==='demos'?(data?.demos||[]).length:(data?.groups||[]).length}
function emptyRelease(){return {version:'',channel:'preview',platform:'Windows',architecture:'x64',title:'LingBuilder 中文集成开发环境',summary:'',releaseNotes:'',minimumRequirements:'Windows 10/11',fileSize:'',sha256:'',publicationStatus:'DRAFT',sortOrder:0}}
function emptyCommand(){return {name:'',stableKey:'',kind:'COMMAND',category:'其他',moduleId:'',moduleName:'',signature:'',returnType:'void',summary:'',parametersJson:'[]',examplesText:'',supportedBackendsText:'',minimumVersion:'',lifecycle:'AVAILABLE',publicationStatus:'DRAFT'}}
function emptyGuide(){return {slug:'',title:'',kind:'CONTROL',category:'',summary:'',bodyMarkdown:'# 标题\n\n开始编写正文。',tagsText:'',minimumVersion:'',coverImageUrl:'',publicationStatus:'DRAFT',sortOrder:0}}
function emptyDemo(){return {slug:'',title:'',category:'入门',difficulty:'入门',summary:'',lingBuilderVersion:'',modulesText:'',prerequisites:'',sourceLinksJson:'[\n  {"label":"下载源码","url":"/examples/"}\n]',screenshotUrl:'',videoUrl:'',license:'示例许可',publicationStatus:'DRAFT',sortOrder:0}}
function emptyGroup(){return {name:'LingBuilder 官方 QQ 交流群',qqNumber:'',groupType:'官方交流群',statusText:'开放加入',description:'',joinUrl:'',qrCodeUrl:'',enabled:true,sortOrder:0}}
interface AdminProps { data:any; request:Request; reload:()=>Promise<void> }
interface Field { name:string; label:string; type:'text'|'number'|'select'|'checkbox'|'textarea'|'textarea-large'; options?:Array<string|{value:string;label:string}> }
const statuses=['DRAFT','PUBLISHED','ARCHIVED'];
