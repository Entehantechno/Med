import React from 'react';

export default function AiRoutesEditor({ cfg, onChange, providers = [], fa = true }) {
  const routes = cfg.routes || [];
  const patch = (index, update) => onChange({ ...cfg, routes: routes.map((r, i) => i === index ? { ...r, ...update } : r) });
  const move = (i, offset) => {
    const next = [...routes];
    [next[i], next[i + offset]] = [next[i + offset], next[i]];
    onChange({ ...cfg, routes: next });
  };
  const add = (legacy = false) => onChange({ ...cfg, routes: [...routes, {
    id: globalThis.crypto?.randomUUID?.() || `route-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    label: `${fa ? 'اتصال' : 'Connection'} ${routes.length + 1}`, enabled: false,
    provider: legacy ? cfg.provider : 'OpenRouter', model: legacy ? cfg.model : '',
    apiKey: legacy ? cfg.apiKey : '', baseUrl: legacy ? cfg.baseUrl : '',
    quotaGroup: 'openrouter-shared', cooldownSeconds: 60,
  }] });
  return <section className="micro-box mb16" style={{ padding: 16 }} aria-label={fa ? 'ترتیب اتصال‌های هوش مصنوعی' : 'AI connection priority'}>
    <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <input type="checkbox" checked={!!cfg.routingEnabled} onChange={e => onChange({ ...cfg, routingEnabled: e.target.checked })} />
      <strong>{fa ? 'استفاده از فهرست اولویت‌دار مدل‌ها و APIها' : 'Use ordered model / API connections'}</strong>
    </label>
    <p className="small muted">{fa
      ? 'در این حالت فقط ردیف‌های فعال، از بالا به پایین استفاده می‌شوند؛ تنظیم تک‌مدلی پایین صفحه نادیده گرفته می‌شود. با فعال‌کردن اتصال پولی، هزینهٔ درخواست‌های آن را می‌پذیرید. خالی‌بودن فهرست فعال یعنی AI در دسترس نیست.'
      : 'Only enabled rows are used, top to bottom; legacy single-model settings are ignored. Enabling a paid connection authorizes its charges. No enabled connections means AI is unavailable.'}</p>
    {cfg.routingEnabled && <>
      <p className="small">{fa
        ? 'پس از محدودیت یا قطع سرویس، ردیف بعدی امتحان می‌شود. پس از زمان اعلام‌شدهٔ سرویس یا زمان انتظار این ردیف، در درخواست بعدی اولویت بالاتر دوباره امتحان می‌شود. برگشت به معنی تضمین رفع محدودیت نیست.'
        : 'On limits or outages, the next row is tried. After Retry-After or the configured cooldown, the higher priority is retried on the next request; recovery is not guaranteed.'}</p>
      {routes.map((r, i) => <fieldset key={r.id} className="card mb16" style={{ minWidth: 0 }}>
        <legend>{fa ? 'اولویت' : 'Priority'} {i + 1}</legend>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <label><input type="checkbox" checked={r.enabled === true} onChange={e => patch(i, { enabled: e.target.checked })} /> {fa ? 'فعال (با پذیرش هزینه احتمالی)' : 'Enabled (charges may apply)'}</label>
          <button type="button" className="btn btn-ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move up ${i + 1}`}>↑</button>
          <button type="button" className="btn btn-ghost" disabled={i === routes.length - 1} onClick={() => move(i, 1)} aria-label={`Move down ${i + 1}`}>↓</button>
          <button type="button" className="btn btn-ghost" onClick={() => onChange({ ...cfg, routes: routes.filter((_, j) => j !== i) })}>{fa ? 'حذف ردیف' : 'Remove row'}</button>
        </div>
        <div className="grid grid-2">
          <label className="field">{fa ? 'نام اتصال' : 'Connection name'}<input value={r.label || ''} onChange={e => patch(i, { label: e.target.value })} /></label>
          <label className="field">{fa ? 'سرویس‌دهنده' : 'Provider'}<select value={r.provider || ''} onChange={e => patch(i, { provider: e.target.value, baseUrl: '', model: '', apiKey: '', clearApiKey: true })}>
            <option value="">—</option>{providers.filter(p => p.key).map(p => <option key={p.key} value={p.key}>{p.label || p.key}</option>)}
          </select></label>
          <label className="field">{fa ? 'شناسه دقیق مدل' : 'Exact model ID'}<input dir="ltr" value={r.model || ''} placeholder="vendor/model:free" onChange={e => patch(i, { model: e.target.value })} /></label>
          <label className="field">API key<input type="password" autoComplete="off" dir="ltr" value={r.apiKey || ''} onChange={e => patch(i, { apiKey: e.target.value, clearApiKey: false })} /></label>
          <label className="field">Base URL<input dir="ltr" value={r.baseUrl || ''} placeholder={providers.find(p => p.key === r.provider)?.base || 'https://…/v1'} onChange={e => patch(i, { baseUrl: e.target.value, apiKey: '', clearApiKey: true })} /></label>
          <label className="field">{fa ? 'زمان انتظار پیش‌فرض، ثانیه (۵ تا ۸۶۴۰۰)' : 'Default cooldown, seconds (5–86400)'}<input type="number" min="5" max="86400" value={r.cooldownSeconds ?? 60} onChange={e => patch(i, { cooldownSeconds: Number(e.target.value) })} /></label>
          <label className="field">{fa ? 'گروه سهمیه حساب OpenRouter' : 'OpenRouter account quota group'}<input value={r.quotaGroup || ''} onChange={e => patch(i, { quotaGroup: e.target.value })} /></label>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => patch(i, { apiKey: '', clearApiKey: true })}>{fa ? 'پاک‌کردن کلید این ردیف' : 'Clear this row’s key'}</button>
      </fieldset>)}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-accent" disabled={routes.length >= 8} onClick={() => add()}>{fa ? 'افزودن اتصال (حداکثر ۸)' : 'Add connection (max 8)'}</button>
        <button type="button" className="btn btn-ghost" disabled={routes.length >= 8} onClick={() => add(true)}>{fa ? 'کپی تنظیم تک‌مدلی به یک ردیف' : 'Copy legacy settings into a row'}</button>
      </div>
      <p className="small muted">{fa
        ? 'ردیف جدید غیرفعال است؛ پس از تکمیل آن را فعال و تنظیمات را ذخیره کنید. چند کلیدِ یک حساب سهمیه بیشتری ندارند؛ گروه سهمیه آنها باید یکسان باشد. 429 عمومی رایگان، همه مدل‌های رایگان آن گروه را موقتاً کنار می‌گذارد؛ خطای مشخصِ ارائه‌دهنده فقط همان ردیف را. این قابلیت سقف خرج مالی نیست.'
        : 'New rows are disabled: configure, enable and save. Keys from the same account share quota and must use the same group. A platform free 429 cools all free models in the group; an identified upstream error only cools that row. This feature is not a spending cap.'}</p>
    </>}
  </section>;
}
