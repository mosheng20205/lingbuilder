import { useEffect, useMemo, useState } from 'react';
import type { SdkCatalogResource } from '@lingbuilder/contracts';
import { HardDriveDownload, ShieldCheck } from 'lucide-react';
import { buildCatalogDiff, parseResourcesJson, ANCHORED_FIELDS, UPDATABLE_FIELDS } from './sdkCatalogAdminModel';
import { DirectUploadPanel, type DirectNotice } from './WebsiteContentAdmin';
import { formatFileSize } from './r2UploadClient';
import './website-admin.css';

type Request = (path: string, init?: RequestInit) => Promise<any>;

const FIELD_LABELS: Record<string, string> = {
  id: '资源 ID', moduleId: '模块 ID', name: '名称', platform: '平台', requiredModuleIds: '依赖模块', criticalFiles: '关键文件',
  version: '版本号', sdkVersion: 'SDK 版本', archiveName: '压缩包名', downloadUrl: '下载地址', archiveBytes: '包大小（字节）',
  sha256: 'SHA-256', fileCount: '文件数', expandedBytes: '解压后大小（字节）'
};
const NUMBER_FIELDS = ['archiveBytes', 'fileCount', 'expandedBytes'];
const KIND_LABELS: Record<string, string> = { added: '新增', removed: '移除', changed: '有修改', unchanged: '无变化' };

export function SdkCatalogAdmin({ data, request, reload, role }: { data: any; request: Request; reload: () => Promise<void>; role: string }) {
  const releases: any[] = data?.releases || [];
  const canPublish = role === '' || role === 'super_admin' || role === 'operator';
  const [current, setCurrent] = useState<{ sequence: number; publishedAt: string; keyId: string; resources: SdkCatalogResource[] } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState<SdkCatalogResource[]>([]);
  const [importText, setImportText] = useState('');
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [uploadTarget, setUploadTarget] = useState('');
  const [uploadNotice, setUploadNotice] = useState<DirectNotice>(null);

  const loadManifest = async () => {
    try {
      const value = await request('/v1/site/sdk-catalog');
      if (!value?.manifest) { setCurrent(null); setDraft([]); return; }
      const payload = JSON.parse(value.manifest.payload);
      const resources: SdkCatalogResource[] = payload.resources ?? [];
      setCurrent({ sequence: payload.sequence, publishedAt: value.manifest.publishedAt, keyId: value.manifest.keyId, resources });
      setDraft(resources.map(item => ({ ...item, requiredModuleIds: [...(item.requiredModuleIds || [])], criticalFiles: [...(item.criticalFiles || [])] })));
    } catch (reason) {
      setMessage({ text: `读取当前清单失败：${reason instanceof Error ? reason.message : String(reason)}`, error: true });
    } finally { setLoaded(true); }
  };
  useEffect(() => { void loadManifest(); }, []);

  const diff = useMemo(() => buildCatalogDiff(current?.resources ?? null, draft), [current, draft]);
  const updateDraft = (id: string, field: string, value: string) => setDraft(list => list.map(item => item.id === id ? { ...item, [field]: NUMBER_FIELDS.includes(field) ? Number(value) : value } : item));
  const importResources = () => {
    try { setDraft(parseResourcesJson(importText)); setMessage(null); }
    catch (reason) { setMessage({ text: reason instanceof Error ? reason.message : String(reason), error: true }); }
  };
  const handleUploaded = (targetId: string) => async (result: { url: string; size: number; sha256: string; version: string }) => {
    setDraft(list => list.map(item => item.id === targetId ? { ...item, downloadUrl: result.url, archiveBytes: result.size, sha256: result.sha256, version: result.version || item.version } : item));
    setUploadNotice({ text: `已回填下载地址、包大小与 SHA-256${result.version ? `，版本号 ${result.version}` : ''}。` });
  };
  const publish = async () => {
    setBusy(true); setMessage(null);
    try {
      await request('/v1/admin/site/sdk-catalog', { method: 'POST', body: JSON.stringify({ resources: draft, note }) });
      setConfirming(false);
      setMessage({ text: '已发布。IDE 生效说明：已安装的 IDE 在下次打开 SDK 面板时自动拉取新清单，无需重新安装；任一校验失败会回退内置清单，不影响下载功能。' });
      setNote('');
      await loadManifest();
      await reload();
    } catch (reason) {
      setMessage({ text: reason instanceof Error ? reason.message : String(reason), error: true });
    } finally { setBusy(false); }
  };

  return <div className="sdk-catalog-layout">
    <section className="site-admin-intro"><div><HardDriveDownload/><span>SDK CATALOG</span><h2>SDK 下载源管理</h2><p>发布整条 SDK 下载清单（Ed25519 签名 + sequence 防回滚）；IDE 校验失败会整体回退内置清单，锚定字段必须与最新 IDE 内置清单逐字一致。</p></div></section>
    {message && <div className={message.error ? 'alert' : 'form-success sdk-banner'} role="status">{message.text}</div>}
    <section className="panel">
      <div className="panel-head"><div><span className="eyebrow">当前版本</span><h2>线上生效清单</h2>{!current && <p>尚未发布过云端清单：IDE 一直使用内置清单，首次发布前需在下方导入资源 JSON。</p>}</div>{current && <span className="badge ok">sequence {current.sequence}</span>}</div>
      {loaded && current && <div className="table-wrap"><table>
        <thead><tr><th>资源</th><th>版本</th><th>下载地址</th><th>包大小</th><th>SHA-256</th><th>锚定字段</th></tr></thead>
        <tbody>{current.resources.map(item => <tr key={item.id}>
          <td>{item.name}<br/><small>{item.id} · {item.moduleId}</small></td>
          <td>{item.version}</td>
          <td className="sdk-url" title={item.downloadUrl}>{item.downloadUrl}</td>
          <td>{formatFileSize(item.archiveBytes)}</td>
          <td className="num" title={item.sha256}>{item.sha256.slice(0, 12)}…</td>
          <td>{item.criticalFiles.length} 个关键文件 · {item.requiredModuleIds.length} 个依赖</td>
        </tr>)}</tbody>
      </table></div>}
      {current && <p className="sdk-effective-note">IDE 生效说明：已安装的 IDE 在下次打开 SDK 面板时拉取本清单；keyId <code>{current.keyId}</code> · 发布时间 {new Date(current.publishedAt).toLocaleString('zh-CN')}</p>}
    </section>
    {canPublish ? <section className="panel">
      <div className="panel-head"><div><span className="eyebrow">编辑清单</span><h2>准备下一版清单</h2><p>灰显字段为锚定字段（远端必须逐字回显，IDE 深度比对），仅可更新字段允许修改。</p></div></div>
      {!current && !draft.length && <div className="sdk-import">
        <p>首次发布：把 IDE 内置清单（electron/src/services/sdkDependencies/sdkDependencyCatalog.ts 中的资源数组）粘贴为 JSON 导入。</p>
        <textarea value={importText} onChange={event => setImportText(event.target.value)} rows={10} placeholder='[{"id":"cef3-sdk", …}] 或 {"resources":[…]}'/>
        <div className="sdk-import-actions"><button className="primary" onClick={importResources}>解析导入</button></div>
      </div>}
      {draft.map(item => <article className="sdk-resource-card" key={item.id}>
        <div className="sdk-resource-head"><strong>{item.name}</strong><span>{item.id} · {item.moduleId} · {item.platform}</span>
          <button className={uploadTarget === item.id ? 'active' : ''} onClick={() => { setUploadTarget(uploadTarget === item.id ? '' : item.id); setUploadNotice(null); }}>上传新包回填</button>
        </div>
        {uploadTarget === item.id && <DirectUploadPanel request={request} notice={uploadNotice} onNotice={setUploadNotice} onUploaded={handleUploaded(item.id)} description="浏览器分片直传 Cloudflare R2；完成后自动回填该资源的下载地址、包大小与 SHA-256。"/>}
        <div className="sdk-anchored">{ANCHORED_FIELDS.map(field => <label key={field}>{FIELD_LABELS[field]}<input value={Array.isArray(item[field]) ? JSON.stringify(item[field]) : String(item[field] ?? '')} disabled readOnly/></label>)}</div>
        <div className="sdk-updatable">{UPDATABLE_FIELDS.map(field => <label key={field}>{FIELD_LABELS[field]}<input type={NUMBER_FIELDS.includes(field) ? 'number' : 'text'} value={String(item[field] ?? '')} onChange={event => updateDraft(item.id, field, event.target.value)}/></label>)}</div>
      </article>)}
      {!!draft.length && <div className="sdk-publish-row">
        <label>发布备注（写入历史与审计）<input value={note} onChange={event => setNote(event.target.value)} placeholder="如：更换 FBro 直链为新 R2 对象"/></label>
        <button className="primary" disabled={!draft.length || busy} onClick={() => setConfirming(true)}>发布确认</button>
      </div>}
    </section> : <section className="panel"><p className="sdk-readonly-note">当前角色（{role || '未知'}）为只读：SDK 清单发布仅限 super_admin 与 operator，support 与 auditor 可查看当前版本与历史。</p></section>}
    <section className="panel">
      <div className="panel-head"><div><span className="eyebrow">发布历史</span><h2>历史清单记录</h2><p>每条记录对应一次整条发布；sequence 单调递增，IDE 拒绝低于已接受值的清单。</p></div></div>
      {releases.length ? <div className="table-wrap"><table>
        <thead><tr><th>sequence</th><th>发布人</th><th>发布时间</th><th>payload 大小</th><th>keyId</th><th>备注</th></tr></thead>
        <tbody>{releases.map(item => <tr key={item.id}>
          <td className="num">{item.sequence}</td>
          <td>{item.createdBy}</td>
          <td>{item.createdAt ? new Date(item.createdAt).toLocaleString('zh-CN') : '—'}</td>
          <td className="num">{item.payloadBytes} B</td>
          <td className="num">{item.keyId}</td>
          <td>{item.note || '—'}</td>
        </tr>)}</tbody>
      </table></div> : <div className="empty">尚无发布历史。</div>}
    </section>
    {confirming && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="发布确认">
      <div className="modal sdk-diff-modal">
        <div className="modal-head"><h3>发布确认 — 与当前线上清单的逐字段比对</h3><button className="modal-close" aria-label="关闭" onClick={() => setConfirming(false)}>×</button></div>
        <div className="modal-body">
          <p className="modal-text">只显示可更新字段的变更；<strong>锚定字段若有变更，IDE 将整条拒绝并回退内置清单</strong>，发布前必须确认它们与最新 IDE 内置清单一致。</p>
          {diff.map(entry => <div className="sdk-diff-entry" key={entry.id}>
            <div className="sdk-diff-head"><strong>{entry.name}</strong><span>{entry.id}</span><span className={`badge ${entry.kind === 'unchanged' ? 'off' : entry.kind === 'removed' ? 'danger' : entry.kind === 'added' ? 'info' : 'warn'}`}>{KIND_LABELS[entry.kind]}</span></div>
            {entry.changes.map(change => <div className="sdk-diff-line" key={change.field}><code>{FIELD_LABELS[change.field] || change.field}</code><span className="sdk-diff-from">{change.from}</span><span aria-hidden="true">→</span><span className="sdk-diff-to">{change.to}</span></div>)}
            {entry.anchoredChanged.length > 0 && <p className="sdk-anchored-warning">锚定字段变更：{entry.anchoredChanged.map(field => FIELD_LABELS[field] || field).join('、')} — 请立即核对，否则 IDE 会拒绝该清单。</p>}
            {entry.kind === 'unchanged' && <p className="sdk-diff-none">该资源没有字段变化。</p>}
          </div>)}
          <label className="sdk-diff-note">发布备注<input value={note} onChange={event => setNote(event.target.value)} placeholder="可留空"/></label>
        </div>
        {message && <div className={message.error ? 'alert' : 'form-success sdk-banner'} role="status">{message.text}</div>}
        <div className="modal-actions"><button onClick={() => setConfirming(false)}>取消</button><button className="primary" disabled={busy} onClick={() => void publish()}>{busy ? '正在发布…' : '确认发布整条清单'}</button></div>
      </div>
    </div>}
  </div>;
}
