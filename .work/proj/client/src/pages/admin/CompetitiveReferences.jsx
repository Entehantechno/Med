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
              <div className="small muted">{[r.short_title, r.edition, r.publisher].filter(Boolean).join(" • ")}{r.pdf_url ? ` • ${fa?"PDF دارد":"has PDF"}` : ""}</div>
              <div className="small muted" style={{wordBreak:"break-all"}}>{r.source_url}{r.pdf_url ? <span style={{display:"block"}}>PDF: <a href={r.pdf_url} target="_blank" rel="noreferrer">{r.pdf_url}</a></span> : null}</div>
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
  const [f,setF]=useState(()=>{
    const base={ code:"", title_fa:"", title_en:"", short_title:"", publisher:"", edition:"", source_url:"", rights_status:"metadata_only", active:1, ...data };
    return {
      ...base,
      cover_url: data.cover_url || base.cover_url || (data.code || base.code ? `/covers/${(data.code||base.code)}.jpg` : ""),
      pdf_url: data.pdf_url || base.pdf_url || "",
    };
  });
  const [pdfBusy,setPdfBusy]=useState(false);
  const set=(k,v)=>setF(s=>({...s,[k]:v}));
  const onPdfFile=async(e)=>{
    const file=e.target.files?.[0]; if(!file) return;
    setPdfBusy(true);
    try{
      const fd=new FormData(); fd.append("pdf", file);
      // token key is medlab_token (see api.js getToken); use helper key for upload
      const tok = (()=>{ try{ return localStorage.getItem("medlab_token")||"";}catch{return "";} })();
      const r=await fetch("/api/upload/pdf",{method:"POST", body: fd, headers: tok ? { Authorization:`Bearer ${tok}` } : {}});
      const j=await r.json();
      if(!r.ok) throw new Error(j.error||"upload failed");
      set("pdf_url", j.url);
    }catch(err){ alert(String(err.message||err)); }
    finally{ setPdfBusy(false); e.target.value=""; }
  };
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
            <div className="field" style={{gridColumn:"1 / -1"}}><label>{fa ? "فایل PDF مرجع (اختیاری — برای ارجاع سوالات)" : "Reference PDF (optional — for question citation)"} </label>
              <div style={{display:"flex", gap:8, alignItems:"center"}}>
                <input value={f.pdf_url} onChange={e=>set("pdf_url",e.target.value)} placeholder="/pdfs/harrison-22e-sample.pdf یا /uploads/pdf_..." style={{flex:1}} />
                <label className="btn btn-ghost btn-sm" style={{whiteSpace:"nowrap", cursor: pdfBusy? "wait":"pointer"}}>
                  {pdfBusy ? (fa?"در حال بارگذاری...":"Uploading...") : (fa?"انتخاب PDF":"Choose PDF")}
                  <input type="file" accept="application/pdf" onChange={onPdfFile} style={{display:"none"}} disabled={pdfBusy} />
                </label>
              </div>
              {f.pdf_url && <div className="small muted" style={{marginTop:6}}><a href={f.pdf_url} target="_blank" rel="noopener noreferrer">{fa ? "مشاهده PDF فعلی" : "Open current PDF"} ↗</a> — <button className="btn btn-ghost btn-sm" type="button" onClick={()=>set("pdf_url","")}>{fa?"حذف":"Remove"}</button></div>}
            </div>
          </div>
          {f.cover_url && <div style={{height:160, border:"1px solid var(--border)", borderRadius:8, background:`center/contain no-repeat url(${f.cover_url})`, backgroundColor:"#fff"}} />}
          <div className="small muted">{fa ? "حقوق: فقط فراداده و ارجاع مجاز است؛ اگر PDF دارای حق نشر است فقط نمونهٔ مجاز یا فایل با مجوز آپلود کنید." : "Rights: metadata + optional PDF — upload only if you have the right to share; otherwise keep link to publisher."}</div>
        </div>
        <div className="modal-foot" style={{display:"flex", gap:8, justifyContent:"flex-end"}}>
          <button className="btn btn-ghost" onClick={onClose}>{fa ? "لغو" : "Cancel"}</button>
          <button className="btn btn-primary" onClick={()=>onSave(f)}>{fa ? "ذخیره" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}
