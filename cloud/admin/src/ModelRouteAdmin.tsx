import React, { useMemo, useState } from 'react';
import { Bot, CheckCircle2, Coins, Search, Zap } from 'lucide-react';

interface Props {
  data: any;
  request: (path: string, init?: RequestInit) => Promise<any>;
  reload: () => Promise<void>;
}

/** 点数换算人民币：1 元 = 10,000 点数。 */
function yuanPreview(points: string): string {
  const value = Number(points);
  if (!Number.isFinite(value) || value <= 0) return '';
  return `≈ ¥${(value / 10000).toLocaleString('zh-CN', { maximumFractionDigits: 4 })} / 百万 tokens`;
}

export function ModelRouteAdmin({ data, request, reload }: Props) {
  const models = (data?.models || []) as any[];
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [inputPoints, setInputPoints] = useState('');
  const [outputPoints, setOutputPoints] = useState('');
  const [peakInputPoints, setPeakInputPoints] = useState('');
  const [peakOutputPoints, setPeakOutputPoints] = useState('');

  const providerOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const model of models) for (const route of model.routes || []) if (route.provider?.id) seen.set(route.provider.id, route.provider.name || route.provider.id);
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [models]);

  const filtered = useMemo(() => models.filter(row => JSON.stringify(row, (_key, value) => typeof value === 'bigint' ? value.toString() : value).toLowerCase().includes(query.toLowerCase())), [models, query]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true); setMessage(''); setError('');
    const form = new FormData(event.currentTarget);
    const peakFilled = [form.get('peakInputPointsPerMillion'), form.get('peakOutputPointsPerMillion')].every(value => String(value || '').trim() !== '');
    const value: Record<string, unknown> = {
      alias: String(form.get('alias') || ''),
      displayName: String(form.get('displayName') || ''),
      providerId: String(form.get('providerId') || ''),
      upstreamModel: String(form.get('upstreamModel') || ''),
      inputPointsPerMillion: String(form.get('inputPointsPerMillion') || '0'),
      outputPointsPerMillion: String(form.get('outputPointsPerMillion') || '0'),
      cachedInputPointsPerMillion: String(form.get('cachedInputPointsPerMillion') || '0'),
      ...(peakFilled ? {
        peakInputPointsPerMillion: String(form.get('peakInputPointsPerMillion') || ''),
        peakOutputPointsPerMillion: String(form.get('peakOutputPointsPerMillion') || ''),
        peakCachedInputPointsPerMillion: String(form.get('peakCachedInputPointsPerMillion') || form.get('peakInputPointsPerMillion') || ''),
        ...(String(form.get('peakWindowsJson') || '').trim() ? { peakWindowsJson: String(form.get('peakWindowsJson') || '').trim() } : {})
      } : {})
    };
    try {
      await request('/v1/admin/model-routes', { method: 'POST', body: JSON.stringify(value) });
      setMessage('模型已发布，IDE 的模型列表会立即看到它。');
      event.currentTarget.reset();
      setInputPoints(''); setOutputPoints(''); setPeakInputPoints(''); setPeakOutputPoints('');
      await reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };

  return <>
    <section className="panel">
      <div className="panel-head">
        <div><span className="eyebrow">MODEL ROUTING</span><h2>发布逻辑模型</h2><p>IDE 只认识这里的模型别名；基础价即空闲时段价，填齐高峰价后自动按时段计费。</p></div>
      </div>
      {providerOptions.length === 0 && <div className="alert" role="alert">还没有可用的 AI 供应商。请先到“系统 AI 供应商”页配置 DeepSeek 或自定义供应商，再回来发布模型。</div>}
      <form onSubmit={submit}>
        <h3 className="form-section-title"><Bot size={15}/>基础信息</h3>
        <div className="form-grid">
          <label className="field"><span>模型别名</span><input name="alias" required pattern="[a-z0-9][a-z0-9._-]{1,63}" placeholder="如 deepseek-v4-flash"/><span className="field-hint">小写字母、数字、点、下划线、中划线；这是 IDE 中显示的模型标识。</span></label>
          <label className="field"><span>显示名称</span><input name="displayName" required placeholder="如 DeepSeek V4 Flash"/><span className="field-hint">用户在 IDE 模型下拉框中看到的名称。</span></label>
          <label className="field"><span>AI 供应商</span><select name="providerId" required defaultValue={providerOptions[0]?.id || ''}>{providerOptions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><span className="field-hint">在“系统 AI 供应商”页维护。</span></label>
          <label className="field"><span>真实模型名</span><input name="upstreamModel" required placeholder="如 deepseek-chat"/><span className="field-hint">供应商接口的实际 model 参数。</span></label>
        </div>

        <div className="form-section">
          <h3 className="form-section-title"><Coins size={15}/>空闲时段定价 <small>（基础价，1 元 = 10,000 点数）</small></h3>
          <div className="form-grid">
            <label className="field"><span>输入点数 / 百万 tokens</span><input name="inputPointsPerMillion" type="number" min="0" required value={inputPoints} onChange={event => setInputPoints(event.target.value)}/>{yuanPreview(inputPoints) && <span className="field-preview">{yuanPreview(inputPoints)}</span>}</label>
            <label className="field"><span>输出点数 / 百万 tokens</span><input name="outputPointsPerMillion" type="number" min="0" required value={outputPoints} onChange={event => setOutputPoints(event.target.value)}/>{yuanPreview(outputPoints) && <span className="field-preview">{yuanPreview(outputPoints)}</span>}</label>
            <label className="field"><span>缓存命中输入点数（可选）</span><input name="cachedInputPointsPerMillion" type="number" min="0" placeholder="留空按 0 计费"/></label>
          </div>
        </div>

        <div className="form-section">
          <h3 className="form-section-title"><Zap size={15}/>高峰时段定价 <small>（可选；默认高峰为北京时间 9:00-12:00、14:00-18:00）</small></h3>
          <div className="form-grid">
            <label className="field"><span>高峰输入点数 / 百万 tokens</span><input name="peakInputPointsPerMillion" type="number" min="0" value={peakInputPoints} onChange={event => setPeakInputPoints(event.target.value)} placeholder="留空表示不分时段"/>{yuanPreview(peakInputPoints) && <span className="field-preview">{yuanPreview(peakInputPoints)}</span>}</label>
            <label className="field"><span>高峰输出点数 / 百万 tokens</span><input name="peakOutputPointsPerMillion" type="number" min="0" value={peakOutputPoints} onChange={event => setPeakOutputPoints(event.target.value)} placeholder="留空表示不分时段"/>{yuanPreview(peakOutputPoints) && <span className="field-preview">{yuanPreview(peakOutputPoints)}</span>}</label>
            <label className="field"><span>高峰缓存命中输入点数（可选）</span><input name="peakCachedInputPointsPerMillion" type="number" min="0" placeholder="留空则与高峰输入相同"/></label>
            <label className="field"><span>自定义高峰时段 JSON（可选）</span><input name="peakWindowsJson" placeholder='留空使用默认 9-12/14-18；示例 [{"startHour":20,"endHour":23}]'/></label>
          </div>
        </div>

        {error && <div className="alert form-error" role="alert">{error}</div>}
        <div className="form-actions">
          <button className="primary" disabled={busy || providerOptions.length === 0}>{busy ? '正在发布…' : '发布模型'}</button>
          {message && <span className="form-success" role="status"><CheckCircle2 size={15}/>{message}</span>}
        </div>
      </form>
    </section>

    <section className="panel">
      <div className="panel-head">
        <div><span className="eyebrow">PUBLISHED MODELS</span><h2>已发布模型</h2><p>重新填写上方表单并保存同一别名即可更新定价或切换上游模型。</p></div>
        <label className="search"><Search size={16}/><span className="sr-only">筛选模型</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="筛选别名或名称"/></label>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>别名</th><th>显示名称</th><th>上游模型</th><th>空闲价（入/出）</th><th>高峰价（入/出）</th><th>计费模式</th><th>状态</th></tr></thead>
          <tbody>
            {filtered.map(row => {
              const route = (row.routes || [])[0];
              const peak = row.peakInputPointsPerMillion != null;
              const price = (value: unknown) => Number(value || 0).toLocaleString('zh-CN');
              return <tr key={row.alias}>
                <td><strong>{row.alias}</strong></td>
                <td>{row.displayName}</td>
                <td>{route ? `${route.upstreamModel} · ${route.provider?.name || ''}` : '未配置路由'}</td>
                <td className="num">{price(row.inputPointsPerMillion)} / {price(row.outputPointsPerMillion)}</td>
                <td className="num">{peak ? `${price(row.peakInputPointsPerMillion)} / ${price(row.peakOutputPointsPerMillion)}` : '—'}</td>
                <td>{peak ? <span className="badge warn"><Zap size={12}/>高峰 + 空闲</span> : <span className="badge">单一价</span>}</td>
                <td>{row.enabled ? <span className="badge ok">启用</span> : <span className="badge off">停用</span>}</td>
              </tr>;
            })}
          </tbody>
        </table>
        {!filtered.length && <div className="empty">尚未发布模型。配置供应商后在上方发布第一个模型。</div>}
      </div>
    </section>
  </>;
}
