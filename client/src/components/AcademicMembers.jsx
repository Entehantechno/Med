import {useEffect,useRef,useState} from 'react';
import {api} from '../api.js';
import {useApp} from '../context.jsx';
import {Modal} from './UI.jsx';
// Draft deltas survive filtering/paging; unvisited users are never removed.
export default function AcademicMembers({kind,id,onClose,onSaved}){
 const {lang}=useApp(),fa=lang==='fa';const [query,setQuery]=useState(''),[prefix,setPrefix]=useState(''),[status,setStatus]=useState(''),[membership,setMembership]=useState(''),[sort,setSort]=useState('student_no'),[page,setPage]=useState(1),[revision,setRevision]=useState(0);
 const [data,setData]=useState({items:[],total:0}),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false),[draft,setDraft]=useState({});const pending=useRef(false),generation=useRef(0);
 useEffect(()=>{const n=++generation.current;setLoading(true);setError('');const timer=setTimeout(()=>{
 const qs=new URLSearchParams({q:query,prefix,status,membership,sort,page:String(page),pageSize:'50'});
 api.get(`/academic/groups/${kind}/${id}/students?${qs}`).then(r=>{if(n===generation.current)setData(r)}).catch(e=>{if(n===generation.current)setError(e.message)}).finally(()=>{if(n===generation.current)setLoading(false)});
 },200);
 return()=>{clearTimeout(timer);generation.current++};},[kind,id,query,prefix,status,membership,sort,page,revision]);
 const checked=u=>draft[u.id]?.value??!!u.member;
 const choose=(items,value)=>setDraft(prev=>{const next={...prev};for(const u of items){if(value===!!u.member)delete next[u.id];else next[u.id]={value};}return next});
 const selectFiltered=async()=>{
  if(pending.current)return;pending.current=true;setBusy(true);setError('');
  try{
   const qs=new URLSearchParams({q:query,prefix,status,membership,sort,pageSize:'100'});
   const first=await api.get(`/academic/groups/${kind}/${id}/students?${qs}&page=1`);
   if(first.total>10000)throw new Error(fa?'بیش از ۱۰۰۰۰ نتیجه؛ با پیش‌شماره یا نام، فیلتر را محدود کنید.':'More than 10000 results; narrow the name or number-prefix filter.');
   const rows=[...first.items],pages=Math.ceil(first.total/100);
   for(let start=2;start<=pages;start+=4){const batch=await Promise.all(Array.from({length:Math.min(4,pages-start+1)},(_,n)=>api.get(`/academic/groups/${kind}/${id}/students?${qs}&page=${start+n}`)));for(const r of batch)rows.push(...r.items);}
   choose(rows.filter(u=>u.status==='active'),true);
  }catch(e){setError(e.message)}finally{pending.current=false;setBusy(false)}
 };
 const close=()=>{if(!pending.current&&(!Object.keys(draft).length||confirm(fa?'تغییرات ذخیره نشده کنار گذاشته شود؟':'Discard unsaved changes?')))onClose()};
 const save=async()=>{if(pending.current)return;pending.current=true;setBusy(true);setError('');try{const addIds=[],removeIds=[];for(const[k,v]of Object.entries(draft))(v.value?addIds:removeIds).push(Number(k));await api.put(`/academic/groups/${kind}/${id}/members`,{addIds,removeIds});onSaved();}catch(e){setError(e.message)}finally{pending.current=false;setBusy(false)}};
 const field=(setter)=>(e)=>{setter(e.target.value);setPage(1)};
 return <Modal wide title={fa?'انتخاب دانشجویان':'Select students'} onClose={close} onSave={save} saveDisabled={busy||loading||!!error} saveLabel={busy?(fa?'در حال ذخیره…':'Saving…'):(fa?'ذخیره':'Save')}>
 <p className="small muted">{fa?'فقط دانشجویان دانشگاه این کلاس یا آزمون نمایش داده می‌شوند. انتخاب‌ها با تغییر صفحه و فیلتر حفظ می‌شوند.':'Only students of this group’s university are shown. Draft selections persist across pages and filters.'}</p>
 {error&&<div role="alert" className="err-banner">{error}<button type="button" className="btn btn-sm btn-ghost" onClick={()=>{setRevision(r=>r+1)}}>{fa?'تلاش دوباره':'Retry'}</button></div>}
 <fieldset disabled={busy} style={{border:0,padding:0,minWidth:0}}>
 <div className="grid grid-2">
 <label className="field">{fa?'نام، نام کاربری یا شماره دانشجویی':'Name, username or student number'}<input aria-label={fa?'جستجوی دانشجو':'Search students'} value={query} onChange={field(setQuery)}/></label>
 <label className="field">{fa?'پیش‌شماره دانشجویی / ورودی':'Student number prefix / cohort'}<input aria-label={fa?'پیش‌شماره دانشجویی':'Student number prefix'} value={prefix} onChange={field(setPrefix)}/></label>
 <label className="field">{fa?'وضعیت':'Status'}<select value={status} onChange={field(setStatus)}><option value="">{fa?'همه وضعیت‌ها':'All statuses'}</option><option value="active">{fa?'فعال':'Active'}</option><option value="inactive">{fa?'غیرفعال':'Inactive'}</option><option value="pending">{fa?'در انتظار':'Pending'}</option></select></label>
 <label className="field">{fa?'عضویت ذخیره‌شده':'Saved membership'}<select value={membership} onChange={field(setMembership)}><option value="">{fa?'همه':'All'}</option><option value="in">{fa?'عضو':'Member'}</option><option value="out">{fa?'غیرعضو':'Not a member'}</option></select></label>
 <label className="field">{fa?'مرتب‌سازی همه نتایج':'Sort all results'}<select value={sort} onChange={field(setSort)}><option value="student_no">{fa?'شماره دانشجویی':'Student number'}</option><option value="name">{fa?'نام':'Name'}</option></select></label>
 </div>
 <div className="inline-form mt8"><button type="button" className="btn btn-sm btn-ghost" disabled={loading} onClick={()=>choose(data.items.filter(u=>u.status==='active'),true)}>{fa?'انتخاب فعال‌های این صفحه':'Select active on this page'}</button><button type="button" className="btn btn-sm btn-ghost" disabled={loading} onClick={()=>choose(data.items,false)}>{fa?'لغو انتخاب این صفحه':'Clear this page'}</button></div>
 <div className="inline-form mt8"><button type="button" className="btn btn-sm btn-primary" disabled={loading||busy||(status&&status!=='active')} onClick={selectFiltered}>{fa?'انتخاب همه نتایج فعالِ فیلتر':'Select all active filtered results'}</button><button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={()=>setDraft({})}>{fa?'بازنشانی انتخاب‌های ذخیره‌نشده':'Reset unsaved selections'}</button></div>
 <p role="status">{loading?(fa?'در حال جستجو…':'Loading…'):`${data.total} ${fa?'نتیجه':'results'} · ${Object.keys(draft).length} ${fa?'تغییر ذخیره‌نشده':'unsaved changes'}`}</p>
 <div className="inline-form mt8"><button type="button" className="btn btn-sm btn-ghost" disabled={loading||page<=1} onClick={()=>setPage(p=>p-1)}>{fa?'صفحه قبل':'Previous page'}</button><span>{page} / {Math.max(1,Math.ceil(data.total/50))}</span><button type="button" className="btn btn-sm btn-ghost" disabled={loading||page*50>=data.total} onClick={()=>setPage(p=>p+1)}>{fa?'صفحه بعد':'Next page'}</button></div>
 <div aria-busy={loading} style={{opacity:loading?.5:1}}>{data.items.map(u=><label key={u.id} className="toggle-row"><span>{(fa?u.name_fa:u.name_en)||u.name_fa||u.name_en||u.username} <b dir="ltr">{u.student_no||u.username}</b> · {fa?({active:'فعال',inactive:'غیرفعال',pending:'در انتظار'}[u.status]||u.status):u.status}</span><input type="checkbox" checked={checked(u)} disabled={loading||(!checked(u)&&u.status!=='active')} onChange={e=>choose([u],e.target.checked)}/></label>)}</div>
 {!loading&&!data.items.length&&<p>{fa?'نتیجه‌ای یافت نشد':'No results'}</p>}

 </fieldset></Modal>;
}
