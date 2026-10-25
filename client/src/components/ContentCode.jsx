import { useState } from 'react';
import { useApp } from '../context.jsx';

export default function ContentCode({ code }) {
  const { lang } = useApp();
  const [status, setStatus] = useState('');
  if (!code) return <span className="muted">—</span>;
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setStatus(lang === 'fa' ? 'کپی شد' : 'Copied'); }
    catch { setStatus(lang === 'fa' ? 'کد را انتخاب و کپی کنید' : 'Select and copy the code'); }
  };
  return <span style={{ display:'inline-flex', alignItems:'center', gap:4, maxWidth:280 }}>
    <code dir="ltr" style={{ overflowWrap:'anywhere', userSelect:'all', fontSize:11 }}>{code}</code>
    <button type="button" className="btn btn-ghost btn-sm" onClick={copy} aria-label={lang === 'fa' ? `کپی کد ${code}` : `Copy code ${code}`} title={lang === 'fa' ? 'کپی کد ثابت' : 'Copy permanent code'}>⧉</button>
    <span role="status" className="small muted">{status}</span>
  </span>;
}
