import { useEffect, useState } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";

export default function CompetitiveReferences() {
  const { lang } = useApp();
  const fa = lang === "fa";
  const [refs, setRefs] = useState(null);
  const [editing, setEditing] = useState(null);
  const [err, setErr] = useState("");

  const load = () => {
    api.get("/learn/admin/references").then(d=>setRefs(d.references||[])).catch(e=>setErr(String(e.message||e)));
  };
  useEffect(load, []);

  const save = async (data) => {
    try {
      if (data.id) await api.put(`/learn/admin/references/${data.id}`, data);
      else await api.post("/learn/admin/references", data);
      setEditing(null); load();
    } catch(e){ setErr(String(e.message||e)); }
  };
  const del = async (id) => {
    if (!confirm(fa ? "حذف شود؟" : "Delete?")) return;
    await api.del(`/learn/admin/references/${id}`); load();
  };

  if (!refs) return <div className="card"><div className="skeleton" style={{height:160}}/></div>;

  return (
    <div className="page">
      <div className="section-title">
        <h2><Icon name="book" size={22}/> {fa ? "کتابخانهٔ رقابتی — مدیریت رفرنس‌ها" : "Competitive Library — References"}</h2>
        <button className="btn btn-primary btn-sm" onClick={()=>setEditing({})}>+ {fa ? "افزودن کتاب" : "Add book"}</button>
      </div>
      <div className="small muted mb12">{fa ? "این رفرنس‌ها در درسنامهٔ هر سؤال (دکمهٔ «مشاهده در رفرنس») و در کتابخانهٔ دانشجو نمایش داده می‌شوند. کاور، فصل و لینک را دقیق وارد کنید." : "These references power the per-question “View in reference” button and the student library. Fill cover, chapter and link accurately."}</div>
      {err && <div className="ddle-banner bad mb12">{err}</div>}
      <div className="ref-grid">
        {refs.map(r=>(
          <div key={r.id} className="card ref-card" style={{flexDirection:"column", alignItems:"stretch", padding:0, overflow:"hidden"}}>
            <div style={{height:140, background:`center/cover no-repeat url(${r.cover_url || `/covers/${r.code}.jpg`})`, backgroundColor:"#f1f5f9", borderBottom:"1px solid var(--border)"}} />
            <div style={{padding:12}}>
              <div style={{fontWeight:900, fontSize:".92rem"}}>{fa ? (r.title_fa||r.title_en) : (r.title_en||r.title_fa)}</div>
              <div className="small muted">{[r.short_title, r.edition, r.publisher].filter(Boolean).join(" • ")}</div>
              <div className="small muted" style={{wordBreak:"break-all"}}>{r.source_url}</div>
              <div style={{display:"flex", gap:6, marginTop:8}}>
                <button className="btn btn-ghost btn-sm" onClick={()=>setEditing(r)}>{fa ? "ویرایش" : "Edit"}</button>
                <button className="btn btn-danger btn-sm" onClick={()=>del(r.id)}>{fa ? "حذف" : "Delete"}</button>
                {r.source_url && <a className="btn btn-ghost btn-sm" href={r.source_url} target="_blank" rel="noopener noreferrer">↗</a>}
              </div>
            </div>
          </div>
        ))}
      </div>
      {refs.length===0 && <div className="card empty-state"><div className="ico"><Icon name="book" size={40}/></div><h3>{fa?"هنوز کتابی ثبت نشده":"No books yet"}</h3></div>}
      {editing && <RefModal data={editing} onClose={()=>setEditing(null)} onSave={save} />}
    </div>
  );
}

function RefModal({ data, onClose, onSave }){
  const { lang } = useApp();
  const fa = lang==="fa";
  const [f,setF]=useState({
    code:"", title_fa:"", title_en:"", short_title:"", publisher:"", edition:"", source_url:"", cover_url:"", rights_status:"metadata_only", active:1,
    ...data,
    cover_url: data.cover_url || (data.code ? `/covers/${data.code}.jpg` : ""),
  });
  const set=(k,v)=>setF(s=>({...s,[k]:v}));
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:560}}>
        <div className="modal-head"><h3>{f.id ? (fa ? "ویرایش رفرنس" : "Edit reference") : (fa ? "افزودن رفرنس" : "Add reference")}</h3><button className="btn btn-ghost" onClick={onClose}>✕</button></div>
        <div className="modal-body" style={{display:"flex", flexDirection:"column", gap:10}}>
          <div className="field"><label>code (لاتین، یکتا) *</label><input value={f.code} onChange={e=>set("code",e.target.value)} placeholder="harrison-22e" /></div>
          <div className="grid grid-2">
            <div className="field"><label>عنوان فارسی *</label><input value={f.title_fa} onChange={e=>set("title_fa",e.target.value)} /></div>
            <div className="field"><label>Title EN *</label><input value={f.title_en} onChange={e=>set("title_en",e.target.value)} /></div>
            <div className="field"><label>Short title</label><input value={f.short_title} onChange={e=>set("short_title",e.target.value)} /></div>
            <div className="field"><label>Publisher</label><input value={f.publisher} onChange={e=>set("publisher",e.target.value)} /></div>
            <div className="field"><label>Edition</label><input value={f.edition} onChange={e=>set("edition",e.target.value)} placeholder="22e" /></div>
            <div className="field"><label>Source URL (لینک ناشر) *</label><input value={f.source_url} onChange={e=>set("source_url",e.target.value)} placeholder="https://accessmedicine..." /></div>
            <div className="field" style={{gridColumn:"1 / -1"}}><label>Cover URL (مسیر کاور)</label><input value={f.cover_url} onChange={e=>set("cover_url",e.target.value)} placeholder="/covers/harrison-22e.jpg" /></div>
          </div>
          {f.cover_url && <div style={{height:160, border:"1px solid var(--border)", borderRadius:8, background:`center/contain no-repeat url(${f.cover_url})`, backgroundColor:"#fff"}} />}
          <div className="small muted">{fa ? "حقوق: فقط فراداده و ارجاع مجاز است؛ متن کتاب بدون مجوز آپلود نشود." : "Rights: metadata only — do not upload textbook text/figures without licence."}</div>
        </div>
        <div className="modal-foot" style={{display:"flex", gap:8, justifyContent:"flex-end"}}>
          <button className="btn btn-ghost" onClick={onClose}>{fa ? "لغو" : "Cancel"}</button>
          <button className="btn btn-primary" onClick={()=>onSave(f)}>{fa ? "ذخیره" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}
