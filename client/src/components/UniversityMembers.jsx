import './university-members.css';
import {useEffect, useRef, useState} from 'react';
import {api} from '../api.js';
import {useApp} from '../context.jsx';

export default function UniversityMembers({id, revision=0, onRemove}) {
  const {lang,t} = useApp(), fa=lang==='fa';
  const [filters,setFilters]=useState({q:'',prefix:'',role:'',status:'',sort:'role'});
  const [page,setPage]=useState(1), [retry,setRetry]=useState(0);
  const [data,setData]=useState({items:[],total:0,page:1,pageSize:25});
  const [loading,setLoading]=useState(true), [busy,setBusy]=useState(false), [error,setError]=useState('');
  const generation=useRef(0), removing=useRef(false);
  useEffect(()=>{
    const current=++generation.current;
    setLoading(true); setError('');
    const timer=setTimeout(()=>{
      const query=new URLSearchParams({...filters,lang,page:String(page),pageSize:'25'});
      api.get(`/universities/${id}/members?${query}`).then(result=>{
        if(current!==generation.current)return;
        setData(result);
        if(result.page!==page)setPage(result.page);
      }).catch(e=>{if(current===generation.current)setError(e.message);})
        .finally(()=>{if(current===generation.current)setLoading(false);});
    },200);
    return ()=>{clearTimeout(timer);generation.current++;};
  },[id,lang,filters,page,revision,retry]);
  const filter=(key,value)=>{setLoading(true);setPage(1);setFilters(f=>({...f,[key]:value}));};
  const remove=async user=>{
    if(removing.current||loading||error||!onRemove)return;
    if(!window.confirm(`${t('removeFromUni')}: ${user.name}؟`))return;
    removing.current=true;setBusy(true);setError('');
    try {await onRemove(user.id);setRetry(v=>v+1);} catch(e){setError(e.message);}
    finally{removing.current=false;setBusy(false);}
  };
  const text=(en,persian)=>fa?persian:en;
  const fieldStyle={display:'flex',flexDirection:'column',gap:4};
  return <section className="university-members" aria-label={text('University members','اعضای دانشگاه')} aria-busy={loading||busy}>
    <fieldset disabled={busy} style={{border:0,padding:0,margin:'12px 0',display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:12}}>
      <label style={fieldStyle}>{text('Search members','جستجوی اعضا')}<input className="input" value={filters.q} onChange={e=>filter('q',e.target.value)}/></label>
      <label style={fieldStyle}>{text('Student number prefix','پیش‌شماره دانشجویی')}<input className="input" value={filters.prefix} onChange={e=>filter('prefix',e.target.value)}/></label>
      <label style={fieldStyle}>{t('role')}<select className="input" value={filters.role} onChange={e=>filter('role',e.target.value)}><option value="">{text('All roles','همه نقش‌ها')}</option><option value="teacher">{t('teacher')}</option><option value="student">{t('student')}</option></select></label>
      <label style={fieldStyle}>{text('Status','وضعیت')}<select className="input" value={filters.status} onChange={e=>filter('status',e.target.value)}><option value="">{text('All statuses','همه وضعیت‌ها')}</option>{['active','inactive','pending'].map(s=><option key={s} value={s}>{t(s)}</option>)}</select></label>
      <label style={fieldStyle}>{text('Sort all results','مرتب‌سازی همه نتایج')}<select className="input" value={filters.sort} onChange={e=>filter('sort',e.target.value)}><option value="role">{t('role')}</option><option value="name">{t('name')}</option><option value="student_no">{t('studentNo')}</option><option value="id">{text('Creation order','ترتیب ایجاد')}</option></select></label>
    </fieldset>
    {error&&<div role="alert">{error} <button type="button" className="btn btn-sm" disabled={busy} onClick={()=>setRetry(v=>v+1)}>{text('Retry','تلاش دوباره')}</button></div>}
    <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap',margin:'12px 0'}}>
      <span role="status">{loading?text('Loading…','در حال بارگذاری…'):`${data.total} ${text('results','نتیجه')} · ${data.page}/${Math.max(1,Math.ceil(data.total/data.pageSize))}`}</span>
      <button type="button" className="btn btn-sm" disabled={loading||busy||!!error||page<=1} onClick={()=>{setLoading(true);setPage(p=>p-1);}}>{text('Previous page','صفحه قبل')}</button>
      <button type="button" className="btn btn-sm" disabled={loading||busy||!!error||page*data.pageSize>=data.total} onClick={()=>{setLoading(true);setPage(p=>p+1);}}>{text('Next page','صفحه بعد')}</button>
    </div>
    {!loading&&!error&&<div style={{overflowX:'auto'}}><table className="table" style={{minWidth:600,tableLayout:'auto',whiteSpace:'nowrap',wordBreak:'normal'}}><caption className="small muted">{text('Members on this page','اعضای این صفحه')}</caption><thead><tr>{[t('name'),t('studentNo'),t('role'),text('Status','وضعیت'),...(onRemove?[text('Actions','عملیات')]:[])].map((h,i)=><th scope="col" key={i}>{h}</th>)}</tr></thead><tbody>
      {data.items.map(u=><tr key={u.id}><td>{u.name}</td><td>{u.student_no}</td><td>{t(u.role)}</td><td>{t(u.status)}</td>{onRemove&&<td><button type="button" className="btn btn-sm btn-danger" disabled={busy} onClick={()=>remove(u)}>{t('removeFromUni')}</button></td>}</tr>)}
      {!data.items.length&&<tr><td colSpan={onRemove?5:4}>{text('No matching members','عضوی با این مشخصات یافت نشد')}</td></tr>}
    </tbody></table></div>}
  </section>;
}
