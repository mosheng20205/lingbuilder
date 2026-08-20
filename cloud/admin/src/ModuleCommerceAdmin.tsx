import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CircleOff, CreditCard, KeyRound, PackageCheck, Search, ShieldAlert, Upload } from 'lucide-react';
import './module-commerce-admin.css';

interface Props {
  data: any;
  request: (path: string, init?: RequestInit) => Promise<any>;
  reload: () => Promise<void>;
}

export function ModuleCommerceAdmin({ data, request, reload }: Props) {
  const products = data?.products || [];
  const [productId, setProductId] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!productId && products[0]?.id) setProductId(products[0].id); }, [products, productId]);
  const product = products.find((item: any) => item.id === productId);
  const act = async (operation: () => Promise<unknown>, success: string) => {
    setBusy(true); setMessage('');
    try { await operation(); setMessage(success); await reload(); }
    catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };
  const schedule24Hours = (value: string) => {
    setStart(value);
    setEnd(value ? new Date(new Date(value).getTime() + 86_400_000).toISOString().slice(0, 16) : '');
  };

  return <div className="commerce-admin">
    <section className="commerce-readiness" aria-label="正式发布就绪状态">
      {(data?.payment?.providers || []).map((provider: any) => <ReadinessCard key={provider.id} title={provider.label} ready={provider.ready} detail={provider.ready ? '官方商户直连参数完整' : `缺少：${provider.missing.join('、')}`} icon={<CreditCard size={19}/>} />)}
      <ReadinessCard title="Permit 与制品签名" ready={Boolean(data?.artifactReadiness?.ready)} detail={data?.artifactReadiness?.ready ? `稳定密钥 ${data.artifactReadiness.keyId}` : '需要稳定 Permit 密钥和持久化制品目录'} icon={<KeyRound size={19}/>} />
    </section>
    {message && <div className="commerce-message" role="status">{message}</div>}

    <section className="panel">
      <Heading eyebrow="PRODUCT" title="商品、报价与限免" detail="仅供 IDE 和管理后台使用，不会发布到门户官网。"/>
      <form className="commerce-form" onSubmit={event => { event.preventDefault(); const value = Object.fromEntries(new FormData(event.currentTarget).entries()); void act(() => request('/v1/admin/modules/products', { method: 'POST', body: JSON.stringify({ ...value, listed: true, enabled: true }) }), '商品已保存。'); }}>
        <Field label="模块 ID"><input name="moduleId" required placeholder="lingbuilder.vendor.module"/></Field>
        <Field label="商品名称"><input name="name" required/></Field>
        <Field label="商品说明"><input name="description" required/></Field>
        <button className="primary" disabled={busy}>保存商品</button>
      </form>
      {products.length > 0 && <>
        <div className="commerce-divider"/>
        <div className="commerce-form"><Field label="当前商品"><select value={productId} onChange={event => setProductId(event.target.value)}>{products.map((item: any) => <option key={item.id} value={item.id}>{item.name} · {item.moduleId}</option>)}</select></Field></div>
        <form className="commerce-form" onSubmit={event => { event.preventDefault(); const value: any = Object.fromEntries(new FormData(event.currentTarget).entries()); const yuan = Number(value.priceYuan); if (!Number.isFinite(yuan) || yuan <= 0) { setMessage('请输入大于 0 的价格。'); return; } delete value.priceYuan; void act(() => request(`/v1/admin/modules/products/${encodeURIComponent(productId)}/offers`, { method: 'POST', body: JSON.stringify({ ...value, priceMinor: Math.round(yuan * 100) }) }), '报价已创建。'); }}>
          <Field label="报价名称"><input name="name" required placeholder="如：永久授权 / 年度订阅"/></Field>
          <Field label="授权类型"><select name="kind"><option value="perpetual">永久买断</option><option value="fixed_term">固定期限</option></select></Field>
          <Field label="价格（元）"><input name="priceYuan" type="number" step="0.01" min="0.01" required placeholder="如 99.00"/></Field>
          <Field label="授权天数"><input name="durationDays" type="number" min="1" placeholder="买断可留空；期限必填，如 365"/></Field>
          <button className="primary" disabled={busy}>新增报价</button>
        </form>
        {product?.offers?.length > 0 && <div className="offer-chips" aria-label="当前商品报价">{product.offers.map((offer: any) => <span key={offer.id} className={offer.enabled ? 'badge ok' : 'badge off'}>{offer.name} · ¥{(Number(offer.priceMinor) / 100).toFixed(2)}{offer.kind === 'FIXED_TERM' && offer.durationDays ? ` · ${offer.durationDays} 天` : offer.kind === 'PERPETUAL' ? ' · 永久' : ''}</span>)}</div>}
        <form className="commerce-form" onSubmit={event => { event.preventDefault(); const name = String(new FormData(event.currentTarget).get('name') || '模块限时免费'); void act(() => request(`/v1/admin/modules/products/${encodeURIComponent(productId)}/free-windows`, { method: 'POST', body: JSON.stringify({ name, startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString(), timezone: 'Asia/Shanghai', enabled: true }) }), '限免时段已创建。'); }}>
          <Field label="限免活动名称"><input name="name" required defaultValue="模块免费体验日"/></Field>
          <Field label="开始时间"><input type="datetime-local" required value={start} onChange={event => schedule24Hours(event.target.value)}/></Field>
          <Field label="结束时间"><input type="datetime-local" required value={end} onChange={event => setEnd(event.target.value)}/></Field>
          <button className="primary" disabled={busy || !start || !end}>保存限免</button>
        </form>
      </>}
    </section>

    <section className="panel">
      <Heading eyebrow="ENTITLEMENTS" title="管理员赠送与撤销" detail="按注册邮箱赠送永久或限期权益，每次操作都会写入管理员审计。"/>
      <form className="commerce-form" onSubmit={event => { event.preventDefault(); const value = Object.fromEntries(new FormData(event.currentTarget).entries()); void act(() => request('/v1/admin/modules/entitlements/grant', { method: 'POST', body: JSON.stringify(value) }), '模块权益已赠送。'); }}>
        <Field label="用户邮箱或 ID"><input name="email" required/></Field>
        <Field label="模块"><select name="moduleId" value={product?.moduleId || ''} onChange={event => setProductId(products.find((item: any) => item.moduleId === event.target.value)?.id || '')}>{products.map((item: any) => <option key={item.id} value={item.moduleId}>{item.name}</option>)}</select></Field>
        <Field label="授权天数"><input name="durationDays" type="number" min="1" placeholder="留空表示永久"/></Field>
        <Field label="赠送原因"><input name="reason" minLength={3} required/></Field>
        <button className="primary" disabled={busy || !productId}>赠送权益</button>
      </form>
      <Entitlements rows={data?.entitlements || []} busy={busy} onRevoke={(id, reason) => act(() => request(`/v1/admin/modules/entitlements/${encodeURIComponent(id)}/revoke`, { method: 'POST', body: JSON.stringify({ reason }) }), '权益已撤销。')} />
    </section>

    <section className="panel">
      <Heading eyebrow="PROTECTED ARTIFACTS" title="收费模块制品" detail="上传后校验 .lbmod manifest 并用稳定 Ed25519 Permit 密钥签名；只有有权益的 IDE 才能下载。"/>
      <ArtifactUpload products={products} busy={busy} onUpload={input => act(() => request(`/v1/admin/modules/artifacts/${encodeURIComponent(input.moduleId)}/${encodeURIComponent(input.version)}`, { method: 'PUT', headers: { 'content-type': 'application/octet-stream', 'x-module-arch': input.arch, 'x-module-file-name': encodeURIComponent(input.file.name), 'x-minimum-ide-version': input.minimumIdeVersion }, body: input.file }), '模块制品已校验、签名并发布。')} />
      <Artifacts rows={data?.artifacts || []} busy={busy} onToggle={(id, enabled) => act(() => request(`/v1/admin/modules/artifacts/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ enabled }) }), enabled ? '制品已启用。' : '制品已停用。')} />
    </section>

    <Orders rows={data?.orders || []}/>
  </div>;
}

function ReadinessCard({ title, ready, detail, icon }: { title: string; ready: boolean; detail: string; icon: React.ReactNode }) { return <article className={ready ? 'readiness ready' : 'readiness blocked'}><div>{icon}<strong>{title}</strong></div>{ready ? <CheckCircle2 size={19}/> : <ShieldAlert size={19}/>}<p>{detail}</p></article>; }
function Heading({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) { return <div className="panel-head"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{detail}</p></div></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label>{label}{children}</label>; }

function ArtifactUpload({ products, busy, onUpload }: { products: any[]; busy: boolean; onUpload: (value: { moduleId: string; version: string; arch: string; minimumIdeVersion: string; file: File }) => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  return <form className="commerce-form" onSubmit={event => { event.preventDefault(); if (!file) return; const form = new FormData(event.currentTarget); void onUpload({ moduleId: String(form.get('moduleId') || ''), version: String(form.get('version') || ''), arch: String(form.get('arch') || 'any'), minimumIdeVersion: String(form.get('minimumIdeVersion') || ''), file }).then(() => setFile(null)); }}>
    <Field label="收费模块"><select name="moduleId">{products.map(item => <option key={item.id} value={item.moduleId}>{item.name} · {item.moduleId}</option>)}</select></Field>
    <Field label="版本"><input name="version" required placeholder="1.0.0"/></Field>
    <Field label="制品架构"><select name="arch"><option value="any">通用包（含多架构）</option><option value="win32">Win32</option><option value="x64">x64</option></select></Field>
    <Field label="最低 IDE 版本"><input name="minimumIdeVersion" placeholder="0.2.6"/></Field>
    <Field label=".lbmod 文件"><input type="file" accept=".lbmod,application/octet-stream" required onChange={event => setFile(event.target.files?.[0] || null)}/></Field>
    <button className="primary" disabled={busy || !file || products.length === 0}><Upload size={16}/>上传并签名</button>
  </form>;
}

function Entitlements({ rows, busy, onRevoke }: { rows: any[]; busy: boolean; onRevoke: (id: string, reason: string) => Promise<void> }) {
  const [query, setQuery] = useState(''); const [reason, setReason] = useState<Record<string, string>>({}); const filtered = useFiltered(rows, query);
  return <Table title="权益记录" query={query} setQuery={setQuery}><table><thead><tr><th>用户</th><th>模块</th><th>来源</th><th>到期</th><th>状态</th><th>撤销操作</th></tr></thead><tbody>{filtered.map(row => <tr key={row.id}><td>{row.user?.email}</td><td>{row.product?.moduleId}</td><td>{row.source}</td><td>{format(row.endsAt) || '永久'}</td><td>{row.revokedAt ? '已撤销' : '有效'}</td><td>{row.revokedAt ? '—' : <div className="inline-action"><input value={reason[row.id] || ''} onChange={event => setReason(value => ({ ...value, [row.id]: event.target.value }))} aria-label="撤销原因" placeholder="至少 3 个字"/><button disabled={busy || (reason[row.id] || '').trim().length < 3} onClick={() => void onRevoke(row.id, reason[row.id])}><CircleOff size={14}/>撤销</button></div>}</td></tr>)}</tbody></table>{!filtered.length && <Empty text="尚无权益记录"/>}</Table>;
}
function Artifacts({ rows, busy, onToggle }: { rows: any[]; busy: boolean; onToggle: (id: string, enabled: boolean) => Promise<void> }) {
  const [query, setQuery] = useState(''); const filtered = useFiltered(rows, query);
  return <Table title="已发布制品" query={query} setQuery={setQuery}><table><thead><tr><th>模块</th><th>版本</th><th>架构</th><th>大小</th><th>SHA-256</th><th>状态</th><th>操作</th></tr></thead><tbody>{filtered.map(row => <tr key={row.id}><td>{row.moduleId}</td><td>{row.version}</td><td>{row.arch}</td><td>{formatBytes(Number(row.sizeBytes))}</td><td className="hash">{row.sha256}</td><td>{row.enabled ? '可下载' : '已停用'}</td><td><button className="table-action" disabled={busy} onClick={() => void onToggle(row.id, !row.enabled)}>{row.enabled ? <CircleOff size={14}/> : <PackageCheck size={14}/>} {row.enabled ? '停用' : '启用'}</button></td></tr>)}</tbody></table>{!filtered.length && <Empty text="尚未发布收费模块制品"/>}</Table>;
}
function Orders({ rows }: { rows: any[] }) {
  const [query, setQuery] = useState(''); const filtered = useFiltered(rows, query);
  const statusBadge = (status: string) => status === 'PAID' ? <span className="badge ok">已支付</span> : status === 'PENDING' ? <span className="badge warn">待支付</span> : status === 'REFUNDED' ? <span className="badge danger">已退款</span> : <span className="badge off">已取消</span>;
  return <section className="panel"><Heading eyebrow="ORDERS" title="模块订单" detail="查询微信、支付宝订单的支付状态和快照金额。"/><Table title="最近订单" query={query} setQuery={setQuery}><table><thead><tr><th>创建时间</th><th>用户</th><th>模块</th><th>报价</th><th>渠道</th><th>金额</th><th>状态</th><th>订单号</th></tr></thead><tbody>{filtered.map(row => <tr key={row.id}><td>{format(row.createdAt)}</td><td>{row.user?.email}</td><td>{row.product?.moduleId}</td><td>{row.offer?.name}</td><td>{row.provider === 'ALIPAY' ? '支付宝' : row.provider === 'WECHAT' ? '微信' : row.provider}</td><td className="num">¥{(Number(row.amountMinor) / 100).toFixed(2)}</td><td>{statusBadge(row.status)}</td><td className="hash">{row.id}</td></tr>)}</tbody></table>{!filtered.length && <Empty text="尚无模块订单"/>}</Table></section>;
}
function Table({ title, query, setQuery, children }: { title: string; query: string; setQuery: (value: string) => void; children: React.ReactNode }) { return <div className="commerce-table"><div className="commerce-table-head"><h3>{title}</h3><label className="search"><Search size={16}/><span className="sr-only">筛选{title}</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="筛选当前列表"/></label></div><div className="table-wrap">{children}</div></div>; }
function Empty({ text }: { text: string }) { return <div className="empty">{text}</div>; }
function useFiltered(rows: any[], query: string) { return useMemo(() => rows.filter(row => JSON.stringify(row).toLowerCase().includes(query.toLowerCase())), [rows, query]); }
function format(value: unknown) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/u.test(value) ? new Date(value).toLocaleString('zh-CN') : value ? String(value) : ''; }
function formatBytes(value: number) { if (!Number.isFinite(value)) return '—'; if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)} GB`; if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`; return `${Math.ceil(value / 1024)} KB`; }
