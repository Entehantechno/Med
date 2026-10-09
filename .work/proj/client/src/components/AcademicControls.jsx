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
