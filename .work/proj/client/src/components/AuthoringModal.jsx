import {createContext,useContext,useState,useRef,useEffect} from 'react';
import {Modal} from './UI.jsx';
import {useApp} from '../context.jsx';
import './authoring.css';
const AuthorContext=createContext({step:'all',language:'both'});
export function AuthorSection({id,title,children}) {
 const {step}=useContext(AuthorContext);
 return <section className="author-section" hidden={step!=='all'&&step!==id} aria-label={title}><h4>{title}</h4>{children}</section>;
}
// Defined at module scope: typing must never remount the focused input.
export function AuthorField({k,label,area,values,onChange}) {
 const language=/_en$/.test(k)?'en':/_fa$/.test(k)?'fa':undefined;
 return <label className="field" data-content-language={language}><span>{label}</span>{area
 ? <textarea lang={language} dir={language==='en'?'ltr':language==='fa'?'rtl':undefined} value={values[k]??''} onChange={e=>onChange(k,e.target.value)}/>
 : <input lang={language} dir={language==='en'?'ltr':language==='fa'?'rtl':undefined} value={values[k]??''} onChange={e=>onChange(k,e.target.value)}/>}</label>;
}
export function AuthorSummary({data,clinical=false}) {
 const {lang}=useApp();const fa=lang==='fa';
 return <div className="author-summary">
  <p className="muted">{fa?'خلاصهٔ نویسنده است؛ شبیه‌سازی نمره‌دهی یا تأیید علمی نیست.':'Author summary, not a grading simulation or clinical approval.'}</p>
  {['fa','en'].map(l=><div key={l} dir={l==='fa'?'rtl':'ltr'} lang={l}>
   <h4>{l==='fa'?'فارسی':'English'}</h4>
   <strong>{data['title_'+l]||data['q_'+l]||data['questionText_'+l]||'—'}</strong>
   {clinical?<><p>{data['chief_'+l]||'—'}</p><p style={{whiteSpace:'pre-wrap'}}>{data['history_'+l]||'—'}</p><p>{l==='fa'?'تشخیص مورد انتظار: ':'Expected diagnosis: '}{data['diagnosis_'+l]||'—'}</p></>:<>
    <p>{data['q_'+l]||data['questionText_'+l]}</p>
    {data.type==='mcq'&&<ol>{(data.options||[]).map((o,i)=><li key={i}>{o.correct?'✓ ':''}{o[l]||o['text_'+l]||'—'}</li>)}</ol>}

    {data.type==='truefalse'&&<p>{data.answer?(l==='fa'?'درست':'True'):(l==='fa'?'غلط':'False')}</p>}
    {data.type==='fill'&&<p>{data['blank_'+l]||(Array.isArray(data['accept_'+l])?data['accept_'+l].join(', '):data['accept_'+l])||'—'}</p>}
    {data.type==='match'&&<ul>{(data.pairs||[]).map((p,i)=><li key={i}>{(Array.isArray(p)?p[l==='fa'?0:1]:p[l==='fa'?'l':'le'])||'—'} ↔ {(Array.isArray(p)?p[l==='fa'?2:3]:p[l==='fa'?'r':'re'])||'—'}</li>)}</ul>}
    {data.type==='order'&&<ol>{(Array.isArray(data['items_'+l])?data['items_'+l]:String(data['items_'+l]||'').split('\n')).filter(Boolean).map((x,i)=><li key={i}>{x}</li>)}</ol>}
    {data.type==='compare'&&<><p>A: {data['entityA_'+l]||'—'} / B: {data['entityB_'+l]||'—'}</p><ul>{(data.features||[]).map((f,i)=><li key={i}>{f[l]||'—'} — {f.belongs}</li>)}</ul></>}
    {data.type==='kf'&&<ol>{(data.kf?.items||[]).map((x,i)=><li key={i}>{x['prompt_'+l]||'—'}</li>)}</ol>}
    {data.type==='stepwise'&&<ol>{(data.steps||[]).map((x,i)=><li key={i}>{x['prompt_'+l]||'—'}</li>)}</ol>}
    {data.type==='drawing'&&<p>{data.drawing?.['prompt_'+l]||'—'}</p>}
    {data.type==='puzzle'&&<ul>{(data.puzzle?.pins||[]).map((x,i)=><li key={i}>{x['label_'+l]||'—'}</li>)}</ul>}
    <p>{fa?'نوع سؤال: ':'Question type: '}{data.type}</p>
   </>}
  </div>)}
 </div>;
}
export default function AuthoringModal({title,onClose,onSave,sections,children,validate,value}) {
 const {lang}=useApp(),fa=lang==='fa';
 const [language,setLanguage]=useState(lang==='en'?'en':'fa');
 const [step,setStep]=useState(sections[0].id),[dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const saving=useRef(false),body=useRef(null);
 const snapshot=JSON.stringify(value),initialSnapshot=useRef(snapshot);
 const changed=dirty||(value!==undefined&&snapshot!==initialSnapshot.current);
 const close=()=>{if(saving.current)return;if(!changed||window.confirm(fa?'تغییرات ذخیره نشده کنار گذاشته شود؟':'Discard unsaved changes?'))onClose();};
 useEffect(()=>{const warn=e=>{if(changed){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[changed]);
 const save=async()=>{if(saving.current)return;const issue=validate?.();if(issue){setError(issue);setStep('all');setLanguage('both');return;}
  saving.current=true;setBusy(true);setError('');try{await onSave();}catch(e){setError(e.message||String(e));}finally{saving.current=false;setBusy(false);}};
 const navigate=id=>{setStep(id);body.current?.closest('.modal-body')?.scrollTo?.({top:0,behavior:'auto'});};
 const index=sections.findIndex(s=>s.id===step);
 return <Modal title={title} onClose={close} onSave={save} saveDisabled={busy} saveLabel={busy?(fa?'در حال ذخیره…':'Saving…'):(fa?'ذخیره محتوا':'Save content')} wide>
  <AuthorContext.Provider value={{step,language}}><div ref={body} className="authoring" data-language={language} onChangeCapture={()=>setDirty(true)}>
   <div className="author-toolbar">
    <div><b>{fa?'زبان محتوا':'Content language'}</b><div className="author-switch" role="group" aria-label={fa?'زبان محتوا':'Content language'}>
     {[['fa','فارسی'],['en','English'],['both',fa?'هر دو':'Both']].map(([id,label])=><button type="button" key={id} aria-pressed={language===id} onClick={()=>setLanguage(id)}>{label}</button>)}</div></div>
    <span className="small muted">{fa?'تغییر زبان، متن زبان دیگر را پاک یا ترجمه نمی‌کند.':'Switching language never clears or translates the other language.'}</span>
   </div>
   <nav className="author-steps" aria-label={fa?'بخش‌های ویرایش':'Editor sections'}>{sections.map((s,i)=><button type="button" key={s.id} aria-current={step===s.id?'step':undefined} onClick={()=>navigate(s.id)}><span>{i+1}</span>{s.title}</button>)}<button type="button" aria-pressed={step==='all'} onClick={()=>navigate('all')}>{fa?'نمایش همه':'Show all'}</button></nav>
   {error&&<div className="err-banner" role="alert">{error}</div>}
   <p className="small muted" role="status">{changed?(fa?'تغییرات ذخیره نشده':'Unsaved changes'):(fa?'ویرایش محتوا':'Editing content')}</p>
   {children}
   {step!=='all'&&<div className="author-navigation"><button type="button" className="btn btn-ghost" disabled={index<=0} onClick={()=>navigate(sections[index-1].id)}>{fa?'بخش قبل':'Previous section'}</button><span>{index+1} / {sections.length}</span><button type="button" className="btn btn-ghost" disabled={index>=sections.length-1} onClick={()=>navigate(sections[index+1].id)}>{fa?'بخش بعد':'Next section'}</button></div>}
  </div></AuthorContext.Provider>
 </Modal>;
}
