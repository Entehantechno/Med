import UniversitySelect from './UniversitySelect.jsx';
import {useEffect,useState,useRef} from 'react';
import {api} from '../api.js';
import {useApp} from '../context.jsx';
import {Modal} from './UI.jsx';
export function UniversityField({value,onChange,disabled=false}){
 const {user,lang}=useApp(),fa=lang==='fa';const[rows,setRows]=useState([]),[error,setError]=useState('');
 useEffect(()=>{if(user.role==='admin')api.get('/universities').then(r=>setRows(r.universities||[])).catch(e=>setError(e.message))},[user.role]);
 if(user.role!=='admin')return null;
 return <label className="field">{fa?'دانشگاه کلاس / آزمون':'Class / exam university'}{error&&<span role="alert">{error}</span>}<UniversitySelect rows={rows} label={fa?"دانشگاه کلاس / آزمون":"Class / exam university"} value={value||""} disabled={disabled} onChange={v=>onChange(v?Number(v):"")}/></label>;
}
export function GroupUniversity({kind,id,value,onSaved}){
 const {user,lang}=useApp(),fa=lang==='fa';const[uni,setUni]=useState(value),[busy,setBusy]=useState(false),[error,setError]=useState('');
 if(user.role!=='admin')return null;
 const save=async()=>{setBusy(true);setError('');try{await api.put(`/academic/groups/${kind}/${id}/university`,{university_id:uni});onSaved()}catch(e){setError(e.message)}finally{setBusy(false)}};
 return <div className="card mb12"><UniversityField value={uni} onChange={setUni} disabled={busy}/><p className="small muted">{fa?'تغییر دانشگاه فقط برای کلاس یا آزمون خالی مجاز است؛ سوابق و عضویت‌ها خودکار منتقل نمی‌شوند.':'Only empty groups can change university; existing records and memberships are not moved.'}</p>{error&&<div role="alert">{error}</div>}<button type="button" disabled={busy||!uni||Number(uni)===Number(value)} onClick={save}>{fa?'ثبت دانشگاه':'Save university'}</button></div>;
}
export function ContentSharing({kind,row,onChanged}){
 const {user,lang}=useApp(),fa=lang==='fa';const[busy,setBusy]=useState(false),[error,setError]=useState(''),[preview,setPreview]=useState(false);const lock=useRef(false);
 const act=async()=>{if(lock.current)return;lock.current=true;setBusy(true);setError('');try{if(user.role==='admin')await api.put(`/academic/content/${kind}/${row.id}/sharing`,{enabled:!row.shared_to_teachers});else await api.post(`/academic/content/${kind}/${row.id}/copy`,{});onChanged()}catch(e){setError(e.message)}finally{lock.current=false;setBusy(false)}};
 return <div style={{minWidth:160,whiteSpace:'normal'}}>{user.role==='admin'?<button type="button" className={`btn btn-sm ${row.shared_to_teachers?"btn-primary":"btn-ghost"}`} role="switch" aria-checked={!!row.shared_to_teachers} disabled={busy||(!row.active&&!row.shared_to_teachers)} onClick={act}>{fa?(row.shared_to_teachers?'اشتراک با همه اساتید: روشن':'اشتراک با همه اساتید: خاموش'):(row.shared_to_teachers?'Share with all teachers: on':'Share with all teachers: off')}</button>:row.shared_to_teachers?<><span>{fa?'مشترک با اساتید':'Shared with teachers'}</span><button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={act}>{fa?'ساخت نسخه مستقل برای من':'Make my own copy'}</button></>:<span>{fa?'خصوصی دانشگاه':'University content'}</span>}
 <button type="button" className="btn btn-sm btn-ghost" onClick={()=>setPreview(true)}>{fa?'مشاهده محتوا':'View content'}</button>{error&&<div role="alert">{error}</div>}
 {preview&&<Modal wide title={(fa?row.title_fa:row.title_en)||row.public_code} onClose={()=>setPreview(false)}><p>{fa?'اشتراک منبع به معنی اجازه ویرایش اصل محتوا نیست. نسخه‌های ساخته‌شده مستقل‌اند و با خاموش‌کردن اشتراک حذف نمی‌شوند.':'Sharing permits reading, not editing the source. Existing independent copies are not deleted when sharing is disabled.'}</p><pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(row,null,2)}</pre></Modal>}</div>;
}

/* Whole-number minutes from 1 to 1440 (the server enforces the same range). */
export function timerMinutesValid(v){
 const n=Number(v);
 return v!==''&&v!==null&&v!==undefined&&Number.isInteger(n)&&n>=1&&n<=1440;
}

/* Per-case time limit for a class. Default: on, 30 minutes. Used by the class
   create/edit form and by the class settings page. */
export function ClassTimerField({enabled=true,minutes=30,onChange}){
 const {lang}=useApp(),fa=lang==='fa';
 const bad=!!enabled&&!timerMinutesValid(minutes);
 return <fieldset className="card mb12"><legend>{fa?'محدودیت زمان هر کیس':'Time limit per case'}</legend>
  <label className="toggle-row"><span>{fa?'تایمر برای کیس‌های این کلاس فعال باشد':'Timer on for this class’s cases'}</span><input type="checkbox" checked={!!enabled} onChange={(e)=>onChange({timer_enabled:e.target.checked})}/></label>
  <label className="field mt8">{fa?'دقیقه برای هر کیس':'Minutes per case'}<input type="number" min="1" max="1440" step="1" value={minutes} disabled={!enabled} onChange={(e)=>onChange({timer_minutes:e.target.value})} aria-invalid={bad}/></label>
  {bad&&<p role="alert" className="err-banner">{fa?'عدد باید یک عدد صحیح بین ۱ و ۱۴۴۰ دقیقه باشد.':'Enter a whole number from 1 to 1440 minutes.'}</p>}
  <p className="small muted">{fa?'پیش‌فرض ۳۰ دقیقه است. هر دانشجو برای هر کیس همین مدت را دارد و با پایان زمان، پاسخ خودکار ثبت می‌شود. وقتی تایمر خاموش باشد، کیس بدون محدودیت زمانی باز می‌شود.':'Default 30 minutes. Each student gets this time for each case, and the answer is submitted automatically when time runs out. With the timer off, the case opens with no time limit.'}</p>
 </fieldset>;
}

export function ClassQuestionMode({value='perQuestion',onChange}) {
 const {lang}=useApp(),fa=lang==='fa';
 return <fieldset className="card mb12"><legend>{fa?'نحوه نمایش سؤال‌های کلاس':'Class question presentation'}</legend>
  {[['perQuestion',fa?'هر سؤال به صورت جداگانه':'Each question separately'],['combined',fa?'همه سؤال‌ها در یک آزمون':'All questions in one exam']].map(([id,label])=><label key={id} className="toggle-row"><span>{label}</span><input type="radio" name="class-question-mode" value={id} checked={(value==='combined'?'combined':'perQuestion')===id} onChange={()=>onChange(id)}/></label>)}
  <p className="small muted">{fa?'در حالت یک آزمون، سؤال‌های کلاس با یک شروع و یک ثبت نهایی ارائه می‌شوند؛ نمره هر سؤال و محدودیت دفعات شرکت حفظ می‌شود. بیمارهای مجازی همچنان مصاحبه‌های مستقل هستند.':'One exam uses one start and one final submission for the class questions, retaining per-question grades and attempt limits. Virtual-patient interviews remain separate.'}</p>
 </fieldset>;
}
