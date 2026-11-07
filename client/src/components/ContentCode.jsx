import { useState } from 'react';
import '../styles-r63.css';
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

/* Round 63: a short, human-scannable form of a permanent code for tables and
   pickers. The full value (e.g. "FC-3f2a…32 hex") is never printed inline; it
   stays in the tooltip and goes to the clipboard on click. */
export function shortCode(code) {
  const s = String(code || '');
  if (s.length <= 12) return s;
  const dash = s.indexOf('-');
  const prefix = dash > 0 && dash <= 3 ? s.slice(0, dash + 1) : '';
  return `${prefix}…${s.slice(-4)}`;
}

export function CompactCode({ code }) {
  const { lang } = useApp();
  const [copied, setCopied] = useState(false);
  if (!code) return <span className="muted">—</span>;
  const fa = lang === 'fa';
  const copy = async (e) => {
    e.stopPropagation();
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { setCopied(false); }
  };
  return <button type="button" className="cc-compact" onClick={copy} dir="ltr"
    title={`${fa ? 'کد ثابت (کلیک برای کپی): ' : 'Permanent code (click to copy): '}${code}`}
    aria-label={`${fa ? 'کپی کد ثابت' : 'Copy permanent code'} ${shortCode(code)}`}>
    <code>{shortCode(code)}</code>
    <svg className="cc-state" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {copied ? <path d="M20 6 9 17l-5-5" /> : <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>}
    </svg>
  </button>;
}
