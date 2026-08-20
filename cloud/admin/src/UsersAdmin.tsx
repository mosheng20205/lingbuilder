import React, { useMemo, useState } from 'react';
import { Check, Copy, KeyRound, MonitorSmartphone, Search, X } from 'lucide-react';

interface Props {
  data: any;
  request: (path: string, init?: RequestInit) => Promise<any>;
  reload: () => Promise<void>;
}

function formatTime(value: unknown): string {
  return value ? new Date(String(value)).toLocaleString('zh-CN') : '—';
}

function sessionState(row: any): { label: string; tone: 'ok' | 'off' | 'danger' } {
  if (row.revokedAt) return { label: '已撤销', tone: 'danger' };
  if (row.rotatedAt) return { label: '已轮换', tone: 'off' };
  if (new Date(row.expiresAt) < new Date()) return { label: '已过期', tone: 'off' };
  return { label: '在线', tone: 'ok' };
}

export function UsersAdmin({ data, request, reload }: Props) {
  const users = (data?.users || []) as any[];
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [sessionsUser, setSessionsUser] = useState<any | null>(null);
  const [sessions, setSessions] = useState<any[] | null>(null);
  const [resetUser, setResetUser] = useState<any | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [copied, setCopied] = useState(false);

  const filtered = useMemo(() => users.filter(row => (row.email || '').toLowerCase().includes(query.toLowerCase())), [users, query]);

  const openSessions = async (user: any) => {
    setSessionsUser(user); setSessions(null); setError('');
    try { const value = await request(`/v1/admin/users/${encodeURIComponent(user.id)}/sessions`); setSessions(value.sessions || []); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); setSessions([]); }
  };

  const doReset = async () => {
    if (!resetUser) return;
    setResetBusy(true); setError(''); setCopied(false);
    try {
      const value = await request(`/v1/admin/users/${encodeURIComponent(resetUser.id)}/password/reset`, { method: 'POST', body: '{}' });
      setTempPassword(value.tempPassword); await reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setResetBusy(false); }
  };

  const copyTemp = async () => { try { await navigator.clipboard.writeText(tempPassword); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* 剪贴板不可用时忽略 */ } };
  const closeReset = () => { setResetUser(null); setTempPassword(''); setCopied(false); };

  return (<>
    {error && <div role="alert" className="alert">{error}<button onClick={() => setError('')}>关闭</button></div>}
    <section className="panel">
      <div className="panel-head"><h2>用户账号</h2><label className="search"><Search size={16}/><span className="sr-only">筛选用户账号</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="按邮箱筛选"/></label></div>
      <div className="table-wrap"><table>
        <thead><tr><th>邮箱</th><th>状态</th><th>可用点数</th><th>管理角色</th><th>注册时间</th><th>操作</th></tr></thead>
        <tbody>{filtered.map(row => (
          <tr key={row.id}>
            <td>{row.email}</td>
            <td><span className={`badge ${row.status === 'ACTIVE' ? 'ok' : 'danger'}`}>{row.status === 'ACTIVE' ? '正常' : row.status}</span></td>
            <td className="num">{row.creditAccount?.available ?? '0'}</td>
            <td>{row.adminMembership?.role ?? '—'}</td>
            <td>{formatTime(row.createdAt)}</td>
            <td><div className="row-actions">
              <button className="ghost-btn" onClick={() => void openSessions(row)}><MonitorSmartphone size={14}/>登录记录</button>
              <button className="ghost-btn" onClick={() => { setResetUser(row); setTempPassword(''); }}><KeyRound size={14}/>重置密码</button>
            </div></td>
          </tr>
        ))}</tbody>
      </table>{!filtered.length && <div className="empty">尚无用户账号</div>}</div>
    </section>

    {sessionsUser && (
      <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`${sessionsUser.email} 的登录记录`}>
        <div className="modal">
          <div className="modal-head"><h3>登录记录 · {sessionsUser.email}</h3><button className="modal-close" aria-label="关闭" onClick={() => setSessionsUser(null)}><X size={16}/></button></div>
          <div className="modal-body">
            <p className="modal-text">最近 50 条登录会话；“在线”表示当前仍有效的会话，撤销/轮换/过期表示已失效。</p>
            {sessions === null ? <div className="empty">正在读取…</div> : (
              <div className="session-list">{sessions.map(item => { const state = sessionState(item); return (
                <div className="session-item" key={item.id}>
                  <div><strong>{item.deviceName || '未知设备'}</strong><span className="session-meta">{formatTime(item.createdAt)} · IP {item.ipAddress || '—'}</span>{item.userAgent ? <span className="session-meta">{String(item.userAgent).slice(0, 90)}</span> : null}</div>
                  <span className={`badge ${state.tone}`}>{state.label}</span>
                </div>
              ); })}{!sessions.length && <div className="empty">尚无登录记录</div>}</div>
            )}
          </div>
        </div>
      </div>
    )}

    {resetUser && (
      <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`重置 ${resetUser.email} 的密码`}>
        <div className="modal">
          <div className="modal-head"><h3>重置密码 · {resetUser.email}</h3><button className="modal-close" aria-label="关闭" onClick={closeReset}><X size={16}/></button></div>
          <div className="modal-body">
            {!tempPassword ? (<>
              <p className="modal-text">密码以单向哈希存储，<strong>任何人无法查看旧密码</strong>。重置会生成一次性临时密码并<strong>撤销该用户全部当前会话</strong>，用户下次登录将被强制修改为新密码。</p>
            </>) : (<>
              <p className="modal-text">临时密码已生成，<strong>仅此次可见</strong>，请通过安全渠道告知用户；用户下次登录必须修改：</p>
              <div className="temp-pw"><code>{tempPassword}</code><button className="ghost-btn" onClick={() => void copyTemp()}>{copied ? <Check size={14}/> : <Copy size={14}/>}{copied ? '已复制' : '复制'}</button></div>
            </>)}
          </div>
          <div className="modal-actions">
            {!tempPassword ? (<><button onClick={closeReset}>取消</button><button className="primary" disabled={resetBusy} onClick={() => void doReset()}>{resetBusy ? '正在重置…' : '生成临时密码'}</button></>) : (<button className="primary" onClick={closeReset}>完成</button>)}
          </div>
        </div>
      </div>
    )}
  </>);
}
