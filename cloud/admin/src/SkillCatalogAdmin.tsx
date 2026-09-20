import { useEffect, useMemo, useState } from 'react';
import { ScrollText } from 'lucide-react';
import {
  SKILL_ANCHORED_FIELDS,
  SKILL_UPDATABLE_FIELDS,
  buildSkillReleaseDiff,
  parseSkillReleaseJson,
  type SkillCatalogRelease
} from './skillCatalogAdminModel';
import { formatFileSize } from './r2UploadClient';
import './website-admin.css';

type Request = (path: string, init?: RequestInit) => Promise<any>;

const FIELD_LABELS: Record<string, string> = {
  id: 'Skill 包 ID', entrypoint: '入口文件', version: '版本号', minIdeVersion: '最低 IDE 版本',
  installPromptTemplate: '一键复制指令模板', files: '文件清单'
};
const FILE_COLUMNS: Array<[keyof SkillCatalogRelease['files'][number], string, boolean]> = [
  ['path', '相对路径', false], ['bytes', '字节数', true], ['sha256', 'SHA-256', false], ['downloadUrl', 'HTTPS 下载地址', false]
];

export function SkillCatalogAdmin({ data, request, reload, role }: { data: any; request: Request; reload: () => Promise<void>; role: string }) {
  const releases: any[] = data?.releases || [];
  const canPublish = role === '' || role === 'super_admin' || role === 'operator';
  const [current, setCurrent] = useState<{ sequence: number; publishedAt: string; keyId: string; release: SkillCatalogRelease } | null>(null);
  const [draft, setDraft] = useState<SkillCatalogRelease | null>(null);
  const [importText, setImportText] = useState('');
  const [note, setNote] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const loadManifest = async () => {
    try {
      const value = await request('/v1/site/skill-catalog');
      if (!value?.manifest) { setCurrent(null); setDraft(null); return; }
      const payload = JSON.parse(value.manifest.payload);
      setCurrent({ sequence: payload.sequence, publishedAt: value.manifest.publishedAt, keyId: value.manifest.keyId, release: payload.release });
    } catch (reason) {
      setMessage({ text: `读取当前 Skill 清单失败：${reason instanceof Error ? reason.message : String(reason)}`, error: true });
    } finally { setLoaded(true); }
  };
  useEffect(() => { void loadManifest(); }, []);

  const diff = useMemo(() => buildSkillReleaseDiff(current?.release ?? null, draft ?? current?.release ?? ({} as SkillCatalogRelease)), [current, draft]);
  const updateScalar = (field: string, value: string) => setDraft(item => item ? { ...item, [field]: value } : item);
  const updateFile = (index: number, field: string, value: string) => setDraft(item => item ? {
    ...item,
    files: item.files.map((file, position) => position === index ? { ...file, [field]: field === 'bytes' ? Number(value) : value } : file)
  } : item);
  const importRelease = () => {
    try { setDraft(parseSkillReleaseJson(importText)); setMessage(null); }
    catch (reason) { setMessage({ text: reason instanceof Error ? reason.message : String(reason), error: true }); }
  };
  const publish = async () => {
    if (!draft) return;
    setBusy(true); setMessage(null);
    try {
      await request('/v1/admin/site/skill-catalog', { method: 'POST', body: JSON.stringify({ release: draft, note }) });
      setConfirming(false); setNote('');
      setMessage({ text: '已发布。IDE 生效说明：已安装的 IDE 在打开「灵码 Skill」窗口时拉取新清单并验签；任一校验失败会回退安装包内置快照，不会中断安装。' });
      await loadManifest();
      await reload();
    } catch (reason) {
      setMessage({ text: reason instanceof Error ? reason.message : String(reason), error: true });
    } finally { setBusy(false); }
  };

  return <div className="sdk-catalog-layout">
    <section className="site-admin-intro"><div><ScrollText/><span>SKILL CATALOG</span><h2>灵码 Skill 发布</h2><p>发布给外部 AI 客户端阅读的 Skill 正文清单（Ed25519 签名 + sequence 防回滚）。正文随 IDE 安装包内置一份离线快照，联网时以这里发布的最新版为准。</p></div></section>
    {message && <div className={message.error ? 'alert' : 'form-success sdk-banner'} role="status">{message.text}</div>}
    <section className="panel">
      <div className="panel-head"><div><span className="eyebrow">当前版本</span><h2>线上生效清单</h2>{!current && <p>尚未发布：IDE 一律使用安装包内置快照。</p>}</div>{current && <span className="badge ok">sequence {current.sequence}</span>}</div>
      {loaded && current && <div className="table-wrap"><table>
        <thead><tr><th>Skill 包</th><th>版本</th><th>入口文件</th><th>文件数</th><th>合计大小</th><th>SHA-256</th></tr></thead>
        <tbody>{current.release.files.map(file => <tr key={file.path}>
          <td>{current.release.id}<br/><small>{file.path}</small></td>
          <td>{current.release.version}</td>
          <td>{current.release.entrypoint}</td>
          <td className="num">{current.release.files.length}</td>
          <td>{formatFileSize(file.bytes)}</td>
          <td className="num" title={file.sha256}>{file.sha256.slice(0, 12)}…</td>
        </tr>)}</tbody>
      </table></div>}
      {current && <p className="sdk-effective-note">IDE 生效说明：已安装的 IDE 在打开「灵码 Skill」窗口时拉取本清单；keyId <code>{current.keyId}</code> · 发布时间 {new Date(current.publishedAt).toLocaleString('zh-CN')} · 最低 IDE 版本 {current.release.minIdeVersion || '不限'}</p>}
    </section>
    {canPublish ? <section className="panel">
      <div className="panel-head"><div><span className="eyebrow">编辑清单</span><h2>准备下一版</h2><p>灰显字段是锚定字段（{SKILL_ANCHORED_FIELDS.join('、')}），改动会让 IDE 整条拒绝；可更新字段：{SKILL_UPDATABLE_FIELDS.join('、')}。</p></div></div>
      {!draft && <div className="sdk-import">
        <p>粘贴清单 JSON（裸对象或 {'{ "release": … }'}）后解析导入；文件路径必须相对 skill-kit 目录，SHA-256 为 64 位小写十六进制，下载地址必须 HTTPS。</p>
        <textarea value={importText} onChange={event => setImportText(event.target.value)} rows={12} placeholder='{"id":"lingbuilder.skill-kit","version":"0.2.0","entrypoint":"SKILL.md","installPromptTemplate":"请读取 {skillPath} …","files":[{"path":"SKILL.md","bytes":7727,"sha256":"…","downloadUrl":"https://…"}]}'/>
        <div className="sdk-import-actions"><button className="primary" onClick={importRelease}>解析导入</button></div>
      </div>}
      {draft && <article className="sdk-resource-card">
        <div className="sdk-resource-head"><strong>{draft.id}</strong><span>{draft.entrypoint} · {draft.files.length} 个文件</span></div>
        <div className="sdk-anchored">{SKILL_ANCHORED_FIELDS.map(field => <label key={field}>{FIELD_LABELS[field]}<input value={String(draft[field as keyof SkillCatalogRelease] ?? '')} disabled readOnly/></label>)}</div>
        <div className="sdk-updatable">
          <label>{FIELD_LABELS.version}<input value={draft.version} onChange={event => updateScalar('version', event.target.value)}/></label>
          <label>{FIELD_LABELS.minIdeVersion}<input value={draft.minIdeVersion} placeholder="留空表示不限" onChange={event => updateScalar('minIdeVersion', event.target.value)}/></label>
        </div>
        <label className="sdk-template">复制给 AI 客户端的指令模板（必须包含 {'{skillPath}'}）
          <textarea rows={3} value={draft.installPromptTemplate} onChange={event => updateScalar('installPromptTemplate', event.target.value)}/>
        </label>
        <div className="table-wrap"><table>
          <thead><tr>{FILE_COLUMNS.map(([, label]) => <th key={label}>{label}</th>)}<th>操作</th></tr></thead>
          <tbody>{draft.files.map((file, index) => <tr key={file.path || index}>
            {FILE_COLUMNS.map(([field, , numeric]) => <td key={String(field)} className={numeric ? 'num' : undefined}>
              <input type={numeric ? 'number' : 'text'} value={String(file[field])} onChange={event => updateFile(index, String(field), event.target.value)}/>
            </td>)}
            <td><button onClick={() => setDraft(item => item ? { ...item, files: item.files.filter((_, position) => position !== index) } : item)}>移除</button></td>
          </tr>)}</tbody>
        </table></div>
        <div className="sdk-publish-row">
          <label>发布备注（写入历史与审计）<input value={note} onChange={event => setNote(event.target.value)} placeholder="如：补充界面配方章节，重发 SKILL.md"/></label>
          <button className="primary" disabled={!draft.files.length || busy} onClick={() => setConfirming(true)}>发布确认</button>
        </div>
      </article>}
    </section> : <section className="panel"><p className="sdk-readonly-note">当前角色（{role || '未知'}）为只读：Skill 清单发布仅限 super_admin 与 operator。</p></section>}
    <section className="panel">
      <div className="panel-head"><div><span className="eyebrow">发布历史</span><h2>历史清单</h2><p>sequence 单调递增，IDE 拒绝低于已接受值的清单（防回滚）。</p></div></div>
      {releases.length ? <div className="table-wrap"><table>
        <thead><tr><th>sequence</th><th>发布人</th><th>发布时间</th><th>payload 大小</th><th>keyId</th><th>备注</th></tr></thead>
        <tbody>{releases.map(item => <tr key={item.id}>
          <td className="num">{item.sequence}</td><td>{item.createdBy}</td>
          <td>{item.createdAt ? new Date(item.createdAt).toLocaleString('zh-CN') : '—'}</td>
          <td className="num">{item.payloadBytes} B</td><td className="num">{item.keyId}</td><td>{item.note || '—'}</td>
        </tr>)}</tbody>
      </table></div> : <div className="empty">尚无发布历史。</div>}
    </section>
    {confirming && draft && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Skill 清单发布确认">
      <div className="modal sdk-diff-modal">
        <div className="modal-head"><h3>发布确认 — 与当前线上清单比对</h3><button className="modal-close" aria-label="关闭" onClick={() => setConfirming(false)}>×</button></div>
        <div className="modal-body">
          {!current && <p className="modal-text">线上尚无清单，本次是首次发布。</p>}
          {current && <p className="modal-text">目标 sequence 将递增为 {current.sequence + 1}；<strong>锚定字段一旦变更，IDE 会整条拒绝并回退包内快照</strong>。</p>}
          {diff.kind === 'new-package' && <p className="sdk-diff-none">新清单（无历史可比对）。</p>}
          {diff.changes.map(change => <div className="sdk-diff-line" key={change.field}>
            <code>{FIELD_LABELS[change.field] || change.field}</code>
            <span className="sdk-diff-from">{change.field === 'files' ? `${JSON.parse(change.from || '[]').length} 个文件` : change.from}</span>
            <span aria-hidden="true">→</span>
            <span className="sdk-diff-to">{change.field === 'files' ? `${draft.files.length} 个文件` : change.to}</span>
          </div>)}
          {!diff.changes.length && diff.kind === 'same-package' && <p className="sdk-diff-none">可更新字段没有变化。</p>}
          {diff.anchoredChanged.length > 0 && <p className="sdk-anchored-warning">锚定字段变更：{diff.anchoredChanged.map(field => FIELD_LABELS[field] || field).join('、')} — 除非确实换了包标识或入口，否则请改回来再发布。</p>}
          <label className="sdk-diff-note">发布备注<input value={note} onChange={event => setNote(event.target.value)} placeholder="可留空"/></label>
        </div>
        {message && <div className={message.error ? 'alert' : 'form-success sdk-banner'} role="status">{message.text}</div>}
        <div className="modal-actions"><button onClick={() => setConfirming(false)}>取消</button><button className="primary" disabled={busy} onClick={() => void publish()}>{busy ? '正在发布…' : '确认发布清单'}</button></div>
      </div>
    </div>}
  </div>;
}
