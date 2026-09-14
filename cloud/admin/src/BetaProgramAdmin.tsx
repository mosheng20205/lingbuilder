import { useEffect, useState } from 'react';
import { FlaskConical } from 'lucide-react';

type Request = (path: string, init?: RequestInit) => Promise<any>;
type Message = { text: string; error?: boolean } | null;

function formatTime(value: unknown): string {
  return value ? new Date(String(value)).toLocaleString('zh-CN') : '—';
}

function formatDate(value: unknown): string {
  return value ? new Date(String(value)).toLocaleDateString('zh-CN') : '长期';
}

function toLocalInputValue(value: unknown): string {
  if (!value) return '';
  const date = new Date(String(value));
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 体验计划管理：名单、自助报名审核与预览渠道暂停开关。 */
export function BetaProgramAdmin({ data, request, reload, role }: { data: any; request: Request; reload: () => Promise<void>; role: string }) {
  const members: any[] = data?.members || [];
  const applications: any[] = data?.applications || [];
  const suspended = Boolean(data?.previewChannelSuspended);
  const canWrite = role === '' || role === 'super_admin' || role === 'operator';

  const [message, setMessage] = useState<Message>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [groupTag, setGroupTag] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [editing, setEditing] = useState<any | null>(null);
  const [editTag, setEditTag] = useState('');
  const [editValidUntil, setEditValidUntil] = useState('');
  const [editNote, setEditNote] = useState('');
  const [rejecting, setRejecting] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [pendingSwitch, setPendingSwitch] = useState<boolean | null>(null);

  const run = async (action: () => Promise<void>) => {
    setBusy(true); setMessage(null);
    try { await action(); }
    catch (reason) { setMessage({ text: reason instanceof Error ? reason.message : String(reason), error: true }); }
    finally { setBusy(false); }
  };

  const searchUsers = () => run(async () => {
    const value = await request(`/v1/admin/users?query=${encodeURIComponent(query.trim())}`);
    setResults((value.users || []).slice(0, 8));
    setSearched(true);
  });

  const addMember = (email: string) => run(async () => {
    await request('/v1/admin/beta-program/members', { method: 'POST', body: JSON.stringify({ email, groupTag, validUntil: validUntil || null }) });
    setMessage({ text: `已把 ${email} 加入体验名单。` });
    setResults(list => list.filter(item => item.email !== email));
    await reload();
  });

  const importBatch = () => run(async () => {
    const value = await request('/v1/admin/beta-program/members/batch', { method: 'POST', body: JSON.stringify({ emails: batchText, groupTag, validUntil: validUntil || null }) });
    const failed: any[] = value.failed || [];
    setMessage({ text: `批量导入完成：成功 ${value.added?.length || 0} 个${failed.length ? `，失败 ${failed.length} 个（${failed.map((item: any) => `${item.email}：${item.reason}`).join('；')}）` : ''}`, error: failed.length > 0 });
    setBatchText('');
    await reload();
  });

  const saveEdit = () => run(async () => {
    await request(`/v1/admin/beta-program/members/${encodeURIComponent(editing.id)}`, { method: 'PATCH', body: JSON.stringify({ groupTag: editTag, validUntil: editValidUntil ? new Date(editValidUntil).toISOString() : null, note: editNote }) });
    setEditing(null);
    setMessage({ text: '名单记录已更新。' });
    await reload();
  });

  const toggleMember = (member: any) => run(async () => {
    await request(`/v1/admin/beta-program/members/${encodeURIComponent(member.id)}`, { method: 'PATCH', body: JSON.stringify({ status: member.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' }) });
    setMessage({ text: member.status === 'ACTIVE' ? `已停用 ${member.email} 的体验资格。` : `已恢复 ${member.email} 的体验资格。` });
    await reload();
  });

  const removeMember = (member: any) => run(async () => {
    await request(`/v1/admin/beta-program/members/${encodeURIComponent(member.id)}`, { method: 'DELETE' });
    setMessage({ text: `已把 ${member.email} 移出体验名单。` });
    await reload();
  });

  const approve = (application: any) => run(async () => {
    await request(`/v1/admin/beta-program/applications/${encodeURIComponent(application.id)}/approve`, { method: 'POST', body: '{}' });
    setMessage({ text: `已通过 ${application.email} 的报名申请。` });
    await reload();
  });

  const reject = () => run(async () => {
    await request(`/v1/admin/beta-program/applications/${encodeURIComponent(rejecting.id)}/reject`, { method: 'POST', body: JSON.stringify({ reason: rejectReason }) });
    setRejecting(null); setRejectReason('');
    setMessage({ text: '已拒绝该报名申请。' });
    await reload();
  });

  const applySwitch = () => run(async () => {
    await request('/v1/admin/beta-program/settings', { method: 'PUT', body: JSON.stringify({ previewChannelSuspended: pendingSwitch }) });
    setPendingSwitch(null);
    setMessage({ text: pendingSwitch ? '预览渠道已暂停：体验用户将冻结在当前版本，直到恢复推送。' : '预览渠道已恢复推送。' });
    await reload();
  });

  return <div>
    <section className="site-admin-intro"><div><FlaskConical size={24}/><span>BETA PROGRAM</span><h2>体验计划管理</h2><p>名单内的账号登录 IDE 后可切换到预览渠道抢先体验新版本；名单外用户继续走稳定渠道。所有变更都会写入管理员审计日志。</p></div></section>
    {message && <div className={message.error ? 'alert' : 'form-success'} role="status">{message.text}</div>}

    <section className="panel">
      <div className="panel-head"><div><span className="eyebrow">渠道开关</span><h2>预览渠道推送</h2><p>{suspended ? '当前状态：已暂停。体验用户停留在当前版本，不会被推送新预览版。' : '当前状态：推送中。发布 preview 渠道版本后，体验用户会收到「抢先体验」更新。'}</p></div><span className={`badge ${suspended ? 'off' : 'ok'}`}>{suspended ? '已暂停' : '推送中'}</span></div>
      {canWrite && <div className="action-form"><button className="primary" disabled={busy} onClick={() => setPendingSwitch(!suspended)}>{suspended ? '恢复预览渠道推送' : '暂停预览渠道推送'}</button><span>出现严重问题时先暂停，再下架问题版本并发布修复版。</span></div>}
    </section>

    <section className="panel">
      <div className="panel-head"><div><span className="eyebrow">报名审核</span><h2>待审核申请{applications.length ? `（${applications.length}）` : ''}</h2><p>用户在 IDE 内自主提交的体验计划申请，通过后立即生效。</p></div></div>
      {applications.length ? <div className="table-wrap"><table>
        <thead><tr><th>邮箱</th><th>申请说明</th><th>申请时间</th><th>操作</th></tr></thead>
        <tbody>{applications.map(item => <tr key={item.id}>
          <td>{item.email}</td>
          <td>{item.message || '—'}</td>
          <td>{formatTime(item.createdAt)}</td>
          <td>{canWrite ? <span className="beta-actions"><button disabled={busy} onClick={() => approve(item)}>通过</button><button disabled={busy} onClick={() => { setRejecting(item); setRejectReason(''); }}>拒绝</button></span> : <span>只读</span>}</td>
        </tr>)}</tbody>
      </table></div> : <div className="empty">暂无待审核的报名申请。</div>}
    </section>

    <section className="panel">
      <div className="panel-head"><div><span className="eyebrow">添加体验用户</span><h2>按邮箱添加或批量导入</h2><p>只允许添加已激活的注册账号；有效期留空表示长期有效。</p></div></div>
      {canWrite ? <div className="action-form">
        <label>分组标签（可选）<input value={groupTag} onChange={event => setGroupTag(event.target.value)} placeholder="如：内测组"/></label>
        <label>资格有效期（可选）<input type="datetime-local" value={validUntil} onChange={event => setValidUntil(event.target.value)}/></label>
        <label>搜索注册账号<button onClick={() => searchUsers()} disabled={busy || !query.trim()}>搜索</button></label>
        <label>批量导入（每行一个邮箱）<textarea rows={3} value={batchText} onChange={event => setBatchText(event.target.value)} placeholder={'a@example.com\nb@example.com'} /></label>
        <button className="primary" disabled={busy || !batchText.trim()} onClick={importBatch}>批量导入</button>
      </div> : <p>当前角色（{role || '未知'}）为只读：名单变更仅限 super_admin 与 operator。</p>}
      {canWrite && searched && <div className="table-wrap"><table>
        <thead><tr><th>邮箱</th><th>账号状态</th><th>操作</th></tr></thead>
        <tbody>{results.map(item => <tr key={item.id}>
          <td>{item.email}</td>
          <td>{item.status === 'ACTIVE' ? '已激活' : item.status === 'PENDING' ? '待验证邮箱' : item.status}</td>
          <td><button disabled={busy} onClick={() => addMember(item.email)}>加入名单</button></td>
        </tr>)}
        {!results.length && <tr><td colSpan={3}>{searched ? '没有匹配的注册账号。' : '输入邮箱关键词后搜索。'}</td></tr>}
        </tbody>
      </table></div>}
    </section>

    <section className="panel">
      <div className="panel-head"><div><span className="eyebrow">体验名单</span><h2>当前名单（{members.length}）</h2><p>停用保留记录便于恢复；移出后账号回到稳定渠道，已安装的预览版会冻结在当前版本。</p></div></div>
      {members.length ? <div className="table-wrap"><table>
        <thead><tr><th>邮箱</th><th>状态</th><th>分组</th><th>有效期</th><th>备注</th><th>添加时间</th>{canWrite && <th>操作</th>}</tr></thead>
        <tbody>{members.map(member => <tr key={member.id}>
          <td>{member.email}</td>
          <td><span className={`badge ${member.active ? (member.status === 'ACTIVE' ? 'ok' : 'off') : 'danger'}`}>{member.status === 'ACTIVE' ? (member.active ? '生效中' : '已过期') : '已停用'}</span></td>
          <td>{member.groupTag || '—'}</td>
          <td>{formatDate(member.validUntil)}</td>
          <td>{member.note || '—'}</td>
          <td>{formatTime(member.createdAt)}</td>
          {canWrite && <td><span className="beta-actions">
            <button disabled={busy} onClick={() => { setEditing(member); setEditTag(member.groupTag || ''); setEditValidUntil(toLocalInputValue(member.validUntil)); setEditNote(member.note || ''); }}>编辑</button>
            <button disabled={busy} onClick={() => toggleMember(member)}>{member.status === 'ACTIVE' ? '停用' : '启用'}</button>
            <button disabled={busy} onClick={() => removeMember(member)}>移除</button>
          </span></td>}
        </tr>)}</tbody>
      </table></div> : <div className="empty">名单为空：添加账号或审核通过报名后，对应客户端即可切换到预览渠道。</div>}
    </section>

    {editing && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="编辑体验名单">
      <div className="modal">
        <div className="modal-head"><h3>编辑体验名单 — {editing.email}</h3><button className="modal-close" aria-label="关闭" onClick={() => setEditing(null)}>×</button></div>
        <div className="modal-body">
          <label className="beta-field">分组标签<input value={editTag} onChange={event => setEditTag(event.target.value)}/></label>
          <label className="beta-field">资格有效期（留空表示长期）<input type="datetime-local" value={editValidUntil} onChange={event => setEditValidUntil(event.target.value)}/></label>
          <label className="beta-field">备注<input value={editNote} onChange={event => setEditNote(event.target.value)}/></label>
        </div>
        <div className="modal-actions"><button onClick={() => setEditing(null)}>取消</button><button className="primary" disabled={busy} onClick={saveEdit}>保存</button></div>
      </div>
    </div>}

    {rejecting && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="拒绝报名">
      <div className="modal">
        <div className="modal-head"><h3>拒绝报名 — {rejecting.email}</h3><button className="modal-close" aria-label="关闭" onClick={() => setRejecting(null)}>×</button></div>
        <div className="modal-body"><label className="beta-field">拒绝理由（可选，留痕审计）<input value={rejectReason} onChange={event => setRejectReason(event.target.value)}/></label></div>
        <div className="modal-actions"><button onClick={() => setRejecting(null)}>取消</button><button className="primary" disabled={busy} onClick={reject}>确认拒绝</button></div>
      </div>
    </div>}

    {pendingSwitch !== null && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="确认切换预览渠道">
      <div className="modal">
        <div className="modal-head"><h3>{pendingSwitch ? '暂停预览渠道推送？' : '恢复预览渠道推送？'}</h3><button className="modal-close" aria-label="关闭" onClick={() => setPendingSwitch(null)}>×</button></div>
        <div className="modal-body"><p>{pendingSwitch ? '暂停后所有体验用户不再收到预览版推送，停留在当前版本；不影响稳定渠道。' : '恢复后体验用户将重新收到预览渠道的最新版本推送。'}</p></div>
        <div className="modal-actions"><button onClick={() => setPendingSwitch(null)}>取消</button><button className="primary" disabled={busy} onClick={applySwitch}>确认</button></div>
      </div>
    </div>}
  </div>;
}
