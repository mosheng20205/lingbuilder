import { useState } from 'react';
import { Crown } from 'lucide-react';

type Request = (path: string, init?: RequestInit) => Promise<any>;
type Message = { text: string; error?: boolean } | null;

function formatYuan(minor: unknown): string {
  const value = Number(minor) || 0;
  return `¥${(value / 100).toLocaleString('zh-CN', { minimumFractionDigits: value % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
}

function formatTime(value: unknown): string {
  return value ? new Date(String(value)).toLocaleString('zh-CN') : '—';
}

function formatDate(value: unknown): string {
  return value ? new Date(String(value)).toLocaleDateString('zh-CN') : '长期';
}

const TIER_LABEL: Record<string, string> = { perpetual: '永久买断', yearly: '一年' };
const SOURCE_LABEL: Record<string, string> = { sponsor_activity: '赞助活动', purchase: '购买', compensation: '补偿' };

/** Pro 会员管理：赞助活动转入（≥99 买断 / <99 赠一年，截止 2026-11-11）、购买入账、补差升级与撤销。 */
export function ProMembershipAdmin({ data, request, reload, role }: { data: any; request: Request; reload: () => Promise<void>; role: string }) {
  const memberships: any[] = data?.memberships || [];
  const sponsors: any[] = data?.sponsors || [];
  const config = data?.config || {};
  const canWrite = role === '' || role === 'super_admin' || role === 'operator' || role === 'support';
  const canUpgrade = role === '' || role === 'super_admin' || role === 'operator';

  const [message, setMessage] = useState<Message>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [source, setSource] = useState('sponsor_activity');
  const [sponsorQq, setSponsorQq] = useState('');
  const [tier, setTier] = useState('perpetual');
  const [priceYuan, setPriceYuan] = useState('');
  const [note, setNote] = useState('');
  const [revoking, setRevoking] = useState<any | null>(null);
  const [revokingReason, setRevokingReason] = useState('');

  const run = async (action: () => Promise<void>) => {
    setBusy(true); setMessage(null);
    try { await action(); }
    catch (reason) { setMessage({ text: reason instanceof Error ? reason.message : String(reason), error: true }); }
    finally { setBusy(false); }
  };

  const create = () => run(async () => {
    if (!email.trim()) throw new Error('请先填写注册邮箱或用户 ID。');
    const body: any = { email: email.trim(), source, tier: source === 'sponsor_activity' ? 'auto' : tier, note };
    if (source === 'sponsor_activity') body.sponsorQq = sponsorQq.trim();
    else body.paidMinor = Math.round((Number(priceYuan) || 0) * 100);
    const value = await request('/v1/admin/pro/memberships', { method: 'POST', body: JSON.stringify(body) });
    setMessage({ text: `已把 ${value.membership?.email || email} 开通为 Pro 会员（${TIER_LABEL[value.membership?.tier] || ''}）。` });
    setEmail(''); setSponsorQq(''); setPriceYuan(''); setNote('');
    await reload();
  });

  const upgrade = (membership: any) => run(async () => {
    const before = Number(membership.paidMinor) || 0;
    const value = await request(`/v1/admin/pro/memberships/${encodeURIComponent(membership.id)}/upgrade`, { method: 'POST', body: '{}' });
    setMessage({ text: `${membership.email} 已升级为永久买断，本次补差 ${formatYuan((Number(value.membership?.paidMinor) || 0) - before)} 入账。` });
    await reload();
  });

  const revoke = () => run(async () => {
    await request(`/v1/admin/pro/memberships/${encodeURIComponent(revoking.id)}/revoke`, { method: 'POST', body: JSON.stringify({ reason: revokingReason }) });
    setRevoking(null); setRevokingReason('');
    setMessage({ text: 'Pro 会员已撤销，对应账号立即失去全部收费模块权益。' });
    await reload();
  });

  const prefillSponsor = (sponsor: any) => {
    setSource('sponsor_activity'); setSponsorQq(sponsor.qqNumber); setTier('perpetual');
    setMessage({ text: `已按 QQ ${sponsor.qqNumber} 预填转入表单：再填写该用户的注册邮箱后提交。` });
  };

  const statusBadge = (membership: any) => membership.revokedAt ? <span className="badge danger">已撤销</span>
    : membership.active ? <span className="badge ok">生效中</span>
      : <span className="badge off">已过期</span>;

  return <div>
    <section className="site-admin-intro"><div><Crown size={24}/><span>PRO MEMBERSHIP</span><h2>Pro 会员管理</h2><p>Pro 会员在生效期内可使用全部收费模块（单模块权益优先）。赞助活动：截止 {formatDate(config.deadline)} 前，累计赞助 ≥ {formatYuan(config.thresholdMinor)} 转永久买断，不足则赠一年；年费会员可补差 {formatYuan(config.upgradePriceMinor)} 升级买断。所有变更写入管理员审计。</p></div></section>
    {message && <div className={message.error ? 'alert' : 'form-success'} role="status">{message.text}</div>}

    <section className="panel">
      <div className="panel-head"><div><span className="eyebrow">赞助名单</span><h2>按 QQ 聚合的赞助记录（{sponsors.length}）</h2><p>金额为活动截止前启用的赞助合计；「转入」会按规则自动定档，再补填注册邮箱即可提交。</p></div></div>
      {sponsors.length ? <div className="table-wrap"><table>
        <thead><tr><th>QQ 号</th><th>笔数</th><th>累计金额</th><th>可转金额</th><th>判定档位</th><th>最近赞助</th><th>已转入</th>{canWrite && <th>操作</th>}</tr></thead>
        <tbody>{sponsors.map(sponsor => <tr key={sponsor.qqNumber}>
          <td>{sponsor.qqNumber}</td>
          <td>{sponsor.count}</td>
          <td>{formatYuan(sponsor.totalMinor)}</td>
          <td>{formatYuan(sponsor.eligibleMinor)}</td>
          <td>{sponsor.eligibleTier === 'perpetual' ? <span className="badge ok">买断档</span> : sponsor.eligibleTier === 'yearly' ? <span className="badge warn">赠一年档</span> : <span className="badge off">不符合</span>}</td>
          <td>{formatTime(sponsor.lastSponsoredAt)}</td>
          <td>{sponsor.convertedEmail || '—'}</td>
          {canWrite && <td><button disabled={busy || sponsor.eligibleTier === 'none'} onClick={() => prefillSponsor(sponsor)}>转入</button></td>}
        </tr>)}</tbody>
      </table></div> : <div className="empty">暂无赞助记录。</div>}
    </section>

    <section className="panel">
      <div className="panel-head"><div><span className="eyebrow">开通会员</span><h2>赞助转入 / 购买入账 / 补偿授予</h2><p>{canWrite ? '赞助转入按 QQ 自动定档并校验资格；购买入账请如实填写金额留痕。' : `当前角色（${role || '未知'}）为只读。`}</p></div></div>
      {canWrite && <div className="action-form">
        <label>注册邮箱或用户 ID<input value={email} onChange={event => setEmail(event.target.value)} placeholder="user@example.com"/></label>
        <label>来源<select value={source} onChange={event => setSource(event.target.value)}>
          <option value="sponsor_activity">赞助活动转入</option>
          <option value="purchase">购买入账</option>
          <option value="compensation">补偿授予</option>
        </select></label>
        {source === 'sponsor_activity'
          ? <label>赞助 QQ 号<input value={sponsorQq} onChange={event => setSponsorQq(event.target.value)} placeholder="按累计赞助自动定档"/></label>
          : <>
            <label>档位<select value={tier} onChange={event => setTier(event.target.value)}>
              <option value="perpetual">永久买断（299）</option>
              <option value="yearly">一年（99）</option>
            </select></label>
            <label>入账金额（元）<input type="number" step="0.01" min="0" value={priceYuan} onChange={event => setPriceYuan(event.target.value)} placeholder="如 299"/></label>
          </>}
        <label>备注<input value={note} onChange={event => setNote(event.target.value)} placeholder="如：双11赞助活动 / 收款码转账后四位"/></label>
        <button className="primary" disabled={busy} onClick={() => void create()}>开通 Pro 会员</button>
      </div>}
    </section>

    <section className="panel">
      <div className="panel-head"><div><span className="eyebrow">会员名单</span><h2>Pro 会员（{memberships.length}）</h2><p>买断长期有效；年费到期后收费模块自动回到购买/限免判定。</p></div></div>
      {memberships.length ? <div className="table-wrap"><table>
        <thead><tr><th>邮箱</th><th>档位</th><th>来源</th><th>赞助 QQ</th><th>已入账</th><th>开始</th><th>到期</th><th>状态</th><th>备注</th>{canWrite && <th>操作</th>}</tr></thead>
        <tbody>{memberships.map(membership => <tr key={membership.id}>
          <td>{membership.email}</td>
          <td>{TIER_LABEL[membership.tier] || membership.tier}</td>
          <td>{SOURCE_LABEL[membership.source] || membership.source}</td>
          <td>{membership.sponsorQq || '—'}</td>
          <td>{formatYuan(membership.paidMinor)}</td>
          <td>{formatTime(membership.startsAt)}</td>
          <td>{formatDate(membership.endsAt)}</td>
          <td>{statusBadge(membership)}</td>
          <td>{membership.note || '—'}</td>
          {canWrite && <td><span className="beta-actions">
            {canUpgrade && membership.tier === 'yearly' && membership.active && <button disabled={busy} onClick={() => void upgrade(membership)}>补差升级买断</button>}
            {!membership.revokedAt && <button disabled={busy} onClick={() => { setRevoking(membership); setRevokingReason(''); }}>撤销</button>}
          </span></td>}
        </tr>)}</tbody>
      </table></div> : <div className="empty">还没有 Pro 会员：从上方赞助名单转入或录入购买。</div>}
    </section>

    {revoking && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="撤销 Pro 会员">
      <div className="modal">
        <div className="modal-head"><h3>撤销 Pro 会员 — {revoking.email}</h3><button className="modal-close" aria-label="关闭" onClick={() => setRevoking(null)}>×</button></div>
        <div className="modal-body"><label className="beta-field">撤销原因（必填，留痕审计）<input value={revokingReason} onChange={event => setRevokingReason(event.target.value)} placeholder="至少 3 个字"/></label></div>
        <div className="modal-actions"><button onClick={() => setRevoking(null)}>取消</button><button className="primary" disabled={busy || revokingReason.trim().length < 3} onClick={revoke}>确认撤销</button></div>
      </div>
    </div>}
  </div>;
}
