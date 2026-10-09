import {useState,useRef,useEffect} from 'react';
import {api} from '../api.js';
import {useApp} from '../context.jsx';
export default function DemoSetup(){
 const {lang}=useApp(),fa=lang==='fa';
 const [open,setOpen]=useState(false),[status,setStatus]=useState(null),[uni,setUni]=useState('');
 const [password,setPassword]=useState(''),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false);
 const [error,setError]=useState(''),[loadError,setLoadError]=useState(''),[result,setResult]=useState(null);
 const saving=useRef(false),loadSeq=useRef(0),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;loadSeq.current++}},[]);
 const refresh=async()=>{
  const seq=++loadSeq.current;setLoading(true);setLoadError('');
  try{const s=await api.get('/admin/demo/status');if(!mounted.current||seq!==loadSeq.current)return;
   setStatus(s);setUni(current=>s.universities.some(u=>String(u.id)===current)?current:String(s.universities.find(u=>u.code==='ARAK')?.id||s.universities[0]?.id||''));
  }catch(e){if(mounted.current&&seq===loadSeq.current)setLoadError(e.message||String(e));}
  finally{if(mounted.current&&seq===loadSeq.current)setLoading(false);}
 };
 const toggle=()=>{if(saving.current)return;if(open){loadSeq.current++;setLoading(false);setOpen(false);}else{setOpen(true);setError('');setResult(null);refresh();}};
 const prepare=async()=>{
  if(saving.current||loading||!confirm||password.length<12||password.length>128||!uni)return;
  saving.current=true;setBusy(true);setError('');setResult(null);
  const target=Number(uni);
  try{const r=await api.post('/admin/demo/prepare',{universityId:target,password,confirm:true});if(!mounted.current)return;
   setResult({...r,universityId:target});setPassword('');setConfirm(false);await refresh();
  }catch(e){if(mounted.current)setError(e.message||String(e));}
  finally{saving.current=false;if(mounted.current)setBusy(false);}
 };
 const summary=status?.emergency?.find(s=>String(s.university_id)===uni);
 return <div className="card mb16" style={{padding:16}}>
  <button type="button" className="btn btn-ghost" onClick={toggle} disabled={busy} aria-expanded={open}>{fa?'بررسی نصب و آماده‌سازی دموی دانشگاهی':'Installation check & academic demo setup'}</button>
  {open&&<div style={{marginTop:12}} aria-busy={busy||loading}>
   <p>{fa?'برای نصب موجود: حساب‌های آزمایشی جداگانه و بیمارهای دانشگاه انتخابی را بدون حذف داده‌ها آماده کنید. رمز، نقش و وضعیت حساب‌های موجود تغییر نمی‌کند. موارد حذف‌شده یا بایگانی‌شده دوباره فعال نمی‌شوند.':'For existing installations: add separate demo accounts and academic cases without deleting data. Existing account passwords, roles and status are never changed. Retired or archived patients are not reactivated.'}</p>
   {loading&&<p role="status">{fa?'در حال بررسی نصب…':'Checking installation…'}</p>}
   {loadError&&<div role="alert" className="err-banner">{fa?'آمار نصب تازه نشد: ':'Installation status could not be refreshed: '}{loadError} <button type="button" disabled={busy||loading} onClick={refresh}>{fa?'تلاش دوباره':'Retry status'}</button></div>}
   {status&&<>
    <p>{fa?'کل کیس‌های فعال به تفکیک دانشگاه: ':'All active cases per university: '}{status.cases.map(c=>`${c.university_id??'—'}: ${c.active}`).join(' | ')||'0'}</p>
    {summary&&<p role="status">{fa?'موجودی ده بیمار اورژانسیِ دانشگاه انتخابی: ':'Emergency-ten inventory for selected university: '}{fa?'فعال':'Active'} {summary.active}/10 · {fa?'بایگانی':'Archived'} {summary.inactive} · {fa?'حذف‌شده':'Retired'} {summary.retired} · {fa?'موجود نیست':'Missing'} {summary.missing} · {fa?'قالب خراب':'Invalid'} {summary.invalid} · {fa?'پروندهٔ ویرایش‌شده':'Modified charts'} {summary.modified}<br/>{fa?'این فقط موجودی نرم‌افزاری است؛ تأیید علمی یا آماده‌بودن نمره‌دهی نیست.':'This is software inventory, not clinical approval or grading readiness.'}</p>}
    <ul>{status.accounts.map(a=><li key={a.username}><code dir="ltr">{a.username}</code> — {a.role} — {a.status}</li>)}</ul>
    <fieldset disabled={busy||loading} style={{border:0,padding:0,margin:0,minWidth:0}}>
     <div className="grid grid-2">
      <label className="field"><span>{fa?'دانشگاه مقصد':'Target university'}</span><select value={uni} onChange={e=>{setUni(e.target.value);setResult(null);setError('');setConfirm(false);setPassword('');}}>{status.universities.map(u=><option value={u.id} key={u.id}>{(fa?u.name_fa:u.name_en)||u.name_en||u.name_fa} (#{u.id})</option>)}</select></label>
      <label className="field"><span>{fa?'رمز حساب‌های جدید (حداقل ۱۲ نویسه)':'New account password (at least 12 characters)'}</span><input type="password" autoComplete="new-password" minLength={12} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/></label>
     </div>
     <label><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/>{fa?'ایجاد دادهٔ آزمایشی در دانشگاه انتخابی را تأیید می‌کنم؛ حساب‌ها را پیش از استفادهٔ عمومی غیرفعال خواهم کرد.':'I confirm demo provisioning in this university and will disable these accounts before public use.'}</label>
     <p><button type="button" className="btn btn-primary" disabled={busy||loading||!confirm||password.length<12||password.length>128||!uni} onClick={prepare}>{busy?(fa?'در حال آماده‌سازی…':'Preparing…'):(fa?'آماده‌سازی ایمن دمو':'Prepare demo safely')}</button></p>
    </fieldset>
   </>}
   {error&&<p role="alert" className="err-banner">{error}</p>}
   {result&&<div role="status"><strong>{fa?'آماده شد؛ نام ورود حساب‌ها:':'Prepared; account usernames:'}</strong> <span>{fa?'دانشگاه':'University'} #{result.universityId}</span><ul>{result.accounts.map(a=><li key={a.username}><code dir="ltr">{a.username}</code> — {a.created?(fa?'ایجاد شد؛ با رمز واردشده':'Created with the supplied password'):(fa?'از قبل موجود؛ رمز تغییر نکرد':'Already exists; password unchanged')}{a.status!=='active'&&<strong> — {fa?'این حساب فعال نیست؛ وضعیت قبلی حفظ شده است.':'This account is inactive; its existing status was retained.'}</strong>}</li>)}</ul><p>{fa?'کیس‌های متصل به دانشجوی دمو: ':'Cases assigned to the demo student: '}{result.caseIds.length}</p></div>}
  </div>}
 </div>;
}
