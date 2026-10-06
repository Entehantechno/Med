import {useState} from 'react';
import {api} from '../api.js';
import {useApp} from '../context.jsx';
export default function DemoSetup(){
 const {lang}=useApp(),fa=lang==='fa';const [open,setOpen]=useState(false),[status,setStatus]=useState(null),[uni,setUni]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState(null);
 const load=async()=>{setOpen(true);try{const s=await api.get('/admin/demo/status');setStatus(s);setUni(String(s.universities[0]?.id||''));}catch(e){setError(e.message);}};
 const prepare=async()=>{if(busy)return;setBusy(true);setError('');try{setResult(await api.post('/admin/demo/prepare',{universityId:Number(uni),password,confirm}));setPassword('');}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <div className="card mb16" style={{padding:16}}>
 <button type="button" className="btn btn-ghost" onClick={()=>open?setOpen(false):load()} aria-expanded={open}>{fa?'بررسی نصب و آماده‌سازی دموی دانشگاهی':'Installation check & academic demo setup'}</button>
 {open&&<div style={{marginTop:12}}>
 <p>{fa?'برای نصب موجود: حساب‌های آزمایشی جداگانه و بیمارهای دانشگاه انتخابی را بدون حذف داده‌ها آماده کنید. رمز، نقش و وضعیت حساب‌های موجود تغییر نمی‌کند. موارد حذف‌شدهٔ دارای شناسه دوباره ایجاد نمی‌شوند.':'For existing installations: add separate demo accounts and academic cases without deleting data. Existing account passwords, roles and status are never changed. Retired source identities are not recreated.'}</p>
 {status&&<><p>{fa?'کیس فعال به تفکیک دانشگاه: ':'Active cases per university: '}{status.cases.map(c=>`${c.university_id??'—'}: ${c.active}`).join(' | ')||'0'}</p>
 <ul>{status.accounts.map(a=><li key={a.username}><code dir="ltr">{a.username}</code> — {a.role} — {a.status}</li>)}</ul>
 <div className="grid grid-2"><label className="field"><span>{fa?'دانشگاه مقصد':'Target university'}</span><select value={uni} onChange={e=>setUni(e.target.value)}>{status.universities.map(u=><option value={u.id} key={u.id}>{fa?u.name_fa:u.name_en} (#{u.id})</option>)}</select></label>
 <label className="field"><span>{fa?'رمز حساب‌های جدید (حداقل ۱۲ نویسه)':'New account password (at least 12 characters)'}</span><input type="password" autoComplete="new-password" minLength={12} value={password} onChange={e=>setPassword(e.target.value)}/></label></div>
 <label><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/>{fa?'ایجاد دادهٔ آزمایشی در دانشگاه انتخابی را تأیید می‌کنم؛ حساب‌ها را پیش از استفادهٔ عمومی غیرفعال خواهم کرد.':'I confirm demo provisioning in this university and will disable these accounts before public use.'}</label>
 <p><button type="button" className="btn btn-primary" disabled={busy||!confirm||password.length<12||!uni} onClick={prepare}>{busy?(fa?'در حال آماده‌سازی…':'Preparing…'):(fa?'آماده‌سازی ایمن دمو':'Prepare demo safely')}</button></p></>}
 {error&&<p role="alert" className="err-banner">{error}</p>}
 {result&&<div role="status"><strong>{fa?'آماده شد؛ نام ورود حساب‌ها:':'Prepared; account usernames:'}</strong><ul>{result.accounts.map(a=><li key={a.username}><code dir="ltr">{a.username}</code> — {a.created?(fa?'ایجاد شد؛ با رمز واردشده':'Created with the supplied password'):(fa?'از قبل موجود؛ رمز تغییر نکرد':'Already exists; password unchanged')}{a.status!=='active'&&<strong> — {fa?'این حساب فعال نیست؛ وضعیت قبلی حفظ شده است.':'This account is inactive; its existing status was retained.'}</strong>}</li>)}</ul><p>{fa?'کیس‌های متصل به دانشجوی دمو: ':'Cases assigned to the demo student: '}{result.caseIds.length}</p></div>}
 </div>}
 </div>;
}
