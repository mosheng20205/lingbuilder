import React, { useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Gift, Search, Sparkles } from 'lucide-react';

interface Props {
  data: any;
  request: (path: string, init?: RequestInit) => Promise<any>;
  reload: () => Promise<void>;
}

type Kind = 'signup_gift' | 'free_window';

/** 把本地时间转成 datetime-local 输入框的值。 */
function toLocalInput(date: Date): string {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

function formatTime(value: unknown): string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/u.test(value) ? new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : value ? String(value) : '—';
}

function promotionStatus(row: any): { label: string; tone: string } {
  if (!row.enabled) return { label: '已停用', tone: 'off' };
  const now = new Date();
  const startsAt = new Date(row.startsAt);
  const endsAt = new Date(row.endsAt);
  if (now < startsAt) return { label: '未开始', tone: 'info' };
  if (now >= endsAt) return { label: '已结束', tone: 'off' };
  return { label: '进行中', tone: 'ok' };
}

export function PromotionAdmin({ data, request, reload }: Props) {
  const promotions = (data?.promotions || []) as any[];
  const [kind, setKind] = useState<Kind>('signup_gift');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const defaults = useMemo(() => {
    const now = new Date();
    return { name: kind === 'signup_gift' ? '新用户注册赠送' : '模型限时免费体验', startsAt: toLocalInput(now), endsAt: toLocalInput(new Date(now.getTime() + 30 * 86_400_000)) };
  }, [kind]);

  const filtered = useMemo(() => promotions.filter(row => JSON.stringify(row, (_key, value) => typeof value === 'bigint' ? value.toString() : value).toLowerCase().includes(query.toLowerCase())), [promotions, query]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true); setMessage(''); setError('');
    const form = new FormData(event.currentTarget);
    const startsAt = new Date(String(form.get('startsAt') || ''));
    const endsAt = new Date(String(form.get('endsAt') || ''));
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) { setError('请选择有效的开始和结束时间。'); setBusy(false); return; }
    if (endsAt <= startsAt) { setError('结束时间必须晚于开始时间。'); setBusy(false); return; }
    const value = {
      name: String(form.get('name') || ''),
      kind,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      timezone: 'Asia/Shanghai',
      giftPoints: form.get('giftPoints') ? Number(form.get('giftPoints')) : undefined,
      perUserListPriceCap: form.get('perUserListPriceCap') ? Number(form.get('perUserListPriceCap')) : undefined,
      perUserRequestCap: form.get('perUserRequestCap') ? Number(form.get('perUserRequestCap')) : undefined,
      modelAliases: String(form.get('modelAliases') || '').split(/[,，\s]+/u).filter(Boolean),
      enabled: true
    };
    try {
      await request('/v1/admin/promotions', { method: 'POST', body: JSON.stringify(value) });
      setMessage(kind === 'signup_gift' ? '新用户赠送活动已创建，注册即自动生效。' : '限时免费窗口已创建，时间按北京时间生效。');
      event.currentTarget.reset();
      await reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };

  return <>
    <section className="panel">
      <div className="panel-head">
        <div><span className="eyebrow">PROMOTIONS</span><h2>创建赠送或限时免费</h2><p>所有时间按北京时间（Asia/Shanghai）生效；活动创建后立即对符合条件的请求生效。</p></div>
      </div>
      <form onSubmit={submit}>
        <fieldset className="seg-picker">
          <legend>选择活动类型</legend>
          <button type="button" className={kind === 'signup_gift' ? 'selected' : ''} onClick={() => setKind('signup_gift')}>
            <Gift size={20}/><span><strong>新用户注册赠送</strong><small>注册成功即一次性赠送点数</small></span>{kind === 'signup_gift' && <CheckCircle2 size={17}/>}
          </button>
          <button type="button" className={kind === 'free_window' ? 'selected' : ''} onClick={() => setKind('free_window')}>
            <Sparkles size={20}/><span><strong>限时免费窗口</strong><small>时间窗口内 AI 请求免点数</small></span>{kind === 'free_window' && <CheckCircle2 size={17}/>}
          </button>
        </fieldset>
        <div className="form-grid">
          <label className="field wide"><span>活动名称</span><input name="name" key={`${kind}-name`} defaultValue={defaults.name} required maxLength={80}/></label>
          <label className="field"><span>开始时间</span><input type="datetime-local" name="startsAt" key={`${kind}-starts`} defaultValue={defaults.startsAt} required/><span className="field-hint">按本机北京时间选择即可，云端自动换算。</span></label>
          <label className="field"><span>结束时间</span><input type="datetime-local" name="endsAt" key={`${kind}-ends`} defaultValue={defaults.endsAt} required/><span className="field-hint">必须晚于开始时间。</span></label>
          {kind === 'signup_gift'
            ? <label className="field"><span>赠送点数</span><input name="giftPoints" type="number" min="1" defaultValue={10000} required/><span className="field-hint">1 元 = 10,000 点数；默认 10,000 相当于 ¥1。</span></label>
            : <>
              <label className="field"><span>单用户免费点数上限（可选）</span><input name="perUserListPriceCap" type="number" min="1" placeholder="留空表示不限"/><span className="field-hint">窗口内每位用户最多免费消耗的点数总量。</span></label>
              <label className="field"><span>单用户免费请求数（可选）</span><input name="perUserRequestCap" type="number" min="1" placeholder="留空表示不限"/><span className="field-hint">窗口内每位用户最多免费请求次数。</span></label>
              <label className="field wide"><span>限定模型（可选）</span><input name="modelAliases" placeholder="留空表示全部模型；多个用逗号分隔，如 deepseek-v4-flash"/><span className="field-hint">只对填写的逻辑模型别名生效，可在“模型路由”页查看别名。</span></label>
            </>}
        </div>
        {error && <div className="alert form-error" role="alert">{error}</div>}
        <div className="form-actions">
          <button className="primary" disabled={busy}>{busy ? '正在创建…' : kind === 'signup_gift' ? '创建赠送活动' : '创建免费窗口'}</button>
          {message && <span className="form-success" role="status"><CheckCircle2 size={15}/>{message}</span>}
        </div>
      </form>
    </section>

    <section className="panel">
      <div className="panel-head">
        <div><span className="eyebrow">ACTIVE PROMOTIONS</span><h2>活动列表</h2><p>进行中的活动会实时生效；结束的活动自动失效，无需手动清理。</p></div>
        <label className="search"><Search size={16}/><span className="sr-only">筛选活动</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="筛选活动名称"/></label>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>活动</th><th>类型</th><th>时间窗口</th><th>限制</th><th>状态</th></tr></thead>
          <tbody>
            {filtered.map(row => {
              const status = promotionStatus(row);
              const limits = row.kind === 'SIGNUP_GIFT'
                ? `赠送 ${Number(row.giftPoints || 0).toLocaleString('zh-CN')} 点数`
                : [row.perUserListPriceCap ? `免费上限 ${Number(row.perUserListPriceCap).toLocaleString('zh-CN')} 点` : '', row.perUserRequestCap ? `限 ${row.perUserRequestCap} 次` : '', (row.modelAliases || []).length ? `限定 ${(row.modelAliases || []).join('、')}` : ''].filter(Boolean).join(' · ') || '不限制';
              return <tr key={row.id}>
                <td>{row.name}</td>
                <td><span className={row.kind === 'SIGNUP_GIFT' ? 'badge info' : 'badge'}>{row.kind === 'SIGNUP_GIFT' ? '注册赠送' : '限时免费'}</span></td>
                <td className="num">{formatTime(row.startsAt)} → {formatTime(row.endsAt)}</td>
                <td>{limits}</td>
                <td><span className={`badge ${status.tone}`}><CalendarDays size={12}/>{status.label}</span></td>
              </tr>;
            })}
          </tbody>
        </table>
        {!filtered.length && <div className="empty">尚无活动。先在上方创建一个赠送活动或免费窗口。</div>}
      </div>
    </section>
  </>;
}
