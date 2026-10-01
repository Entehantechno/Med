import { useEffect, useState } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";

/* Student viewer — opens to the page the author picked, but the whole
   reference is browsable. No copyrighted PDF is hosted here: we only show
   the cover + metadata and link out to the legal publisher site (AccessMedicine,
   ClinicalKey, LWW). If an open-access sample PDF is configured, we can embed
   it with #page= — otherwise the external button is the viewer. */
export default function ReferenceViewer({ code: propCode, initialPage, onBack }) {
  const fallbackCode = (()=>{ try{ const m=/^\/learn\/reference\/([^/?#]+)/.exec(window.location.pathname); return m?decodeURIComponent(m[1]):"";}catch{return "";} })();
  const fallbackPage = (()=>{ try{ return new URLSearchParams(window.location.search).get("page")||"";}catch{return "";} })();
  const code = propCode || fallbackCode;
  const page = initialPage != null ? String(initialPage) : fallbackPage;
  const { lang } = useApp();
  const fa = lang === "fa";
  const [ref, setRef] = useState(null);
  const [err, setErr] = useState("");
  const tBack = fa ? "بازگشت به کتابخانه" : "Back to library";

  useEffect(() => {
    let alive = true;
    if (!code) { setErr(fa ? "رفرنس یافت نشد" : "Reference not found"); return; }
    api.get("/learn/references").then((d) => {
      if (!alive) return;
      const r = (d.references || []).find((x) => x.code === code);
      if (r) setRef(r);
      else setErr(fa ? "رفرنس یافت نشد" : "Reference not found");
    }).catch((e) => { if (alive) setErr(e.message || "error"); });
    return () => { alive = false; };
  }, [code, fa]);

  const goBack = () => {
    if (onBack) return onBack();
    try { window.history.pushState({}, "", "/"); window.dispatchEvent(new CustomEvent("medlab-go",{detail:"library"})); } catch {}
  };

  if (err) return <div className="card empty-state"><div className="ico">⚠️</div><h3>{err}</h3><button className="btn btn-ghost mt16" onClick={goBack}>{tBack}</button></div>;
  if (!ref) return <div className="card"><div className="skeleton" style={{ height: 200 }} /></div>;

  const title = fa ? (ref.title_fa || ref.title_en) : (ref.title_en || ref.title_fa);
  const sourceUrl = ref.source_url || ref.sourceUrl || "";
  const cover = ref.cover_url || ref.coverUrl || `/covers/${ref.code}.jpg`;
  const externalHref = sourceUrl ? `${sourceUrl}${page && sourceUrl.includes("#") ? `&page=${page}` : ""}` : "";
  const canEmbed = ref.pdf_url && !/accessmedicine|clinicalkey|mhmedical/i.test(ref.pdf_url||"");

  return (
    <div className="page" style={{ maxWidth: 980, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <button className="btn btn-ghost btn-sm" onClick={goBack}><Icon name="chevronDown" size={14} style={{ transform: "rotate(90deg)" }} /> {fa ? "کتابخانه" : "Library"}</button>
        {page && <span className="chip" style={{ background: "#eef6ff", border: "1px solid #dbeafe", padding: "2px 8px", borderRadius: 999, fontSize: 12 }}>{fa ? `صفحهٔ پیشنهادی: ${page}` : `Suggested page: ${page}`}</span>}
      </div>

      <div className="card" style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <img src={cover} alt={title} style={{ width: 180, height: 250, objectFit: "cover", borderRadius: 10, border: "1px solid #e8e8e8", boxShadow: "0 4px 16px rgba(0,0,0,.08)" }} onError={(e)=>{ e.currentTarget.style.display="none"; }} />
        <div style={{ flex: 1, minWidth: 240 }}>
          <h2 style={{ margin: "0 0 6px" }}>{title}</h2>
          <div className="muted" style={{ marginBottom: 10 }}>{[ref.short_title, ref.edition ? `${fa ? "ویراست " : "Edition "}${ref.edition}` : null, ref.publisher].filter(Boolean).join(" • ")}</div>
          {page && <div className="small" style={{ background: "#f6f8ff", border: "1px solid #e6e8ff", borderRadius: 8, padding: "8px 10px", marginBottom: 10, lineHeight: 1.8 }}>{fa ? `نویسندهٔ درس این صفحه را برای مطالعه پیشنهاد کرده است: ` : `The author suggests studying: `}<b>{fa ? `صفحه ${page}` : `Page ${page}`}</b>{ref.chapter_hint ? ` — ${ref.chapter_hint}` : ""}</div>}
          <div className="small muted" style={{ lineHeight: 1.9, marginBottom: 12 }}>
            {fa
              ? "به‌دلیل حق نشر، متن کامل کتاب در همین سایت میزبانی نمی‌شود. با دکمهٔ زیر به سایت قانونی ناشر (AccessMedicine / ClinicalKey / LWW) می‌روید؛ اگر دسترسی سازمانی دارید مستقیماً همان صفحه باز می‌شود. می‌توانید کل کتاب را هم مرور کنید."
              : "Due to copyright, the full text is not hosted here. The button below opens the legal publisher site (AccessMedicine / ClinicalKey / LWW). With institutional access the exact page opens directly — you can also browse the whole book."}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {sourceUrl && <a className="btn btn-primary" href={externalHref} target="_blank" rel="noopener noreferrer"><Icon name="book" size={15} /> {fa ? "باز کردن در سایت ناشر" : "Open on publisher site"} ↗</a>}
            {ref.pdf_url && <a className="btn btn-ghost" href={`${ref.pdf_url}${page ? `#page=${page}` : ""}`} target="_blank" rel="noopener noreferrer"><Icon name="book" size={15} /> {fa ? "مشاهده PDF" : "Open PDF"}{page ? ` — ${fa?`ص ${page}`:`p. ${page}`}` : ""} ↗</a>}
            {page && sourceUrl && <span className="small muted" style={{ alignSelf: "center" }}>{fa ? `صفحهٔ پیش‌فرض: ${page}` : `Default: page ${page}`}</span>}
          </div>
          {!sourceUrl && <div className="small muted" style={{ marginTop: 8 }}>{fa ? "لینک ناشر برای این رفرنس فعلاً ثبت نشده است." : "No publisher link configured for this reference yet."}</div>}
        </div>
      </div>

      {canEmbed && (
        <div className="card mt16" style={{ padding: 0, overflow: "hidden" }}>
          <div className="small muted" style={{ padding: "10px 12px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span><Icon name="book" size={14} /> {fa ? "پیش‌نمایش (نمونهٔ آزاد)" : "Preview (open-access sample)"}{page ? ` — ${fa ? "ص" : "p."} ${page}` : ""}</span>
            <a className="btn btn-ghost btn-sm" href={`${ref.pdf_url}${page ? `#page=${page}` : ""}`} target="_blank" rel="noreferrer">{fa ? "تمام‌صفحه" : "Fullscreen"} ↗</a>
          </div>
          <iframe title={title} src={`${ref.pdf_url}${page ? `#page=${page}` : ""}`} style={{ width: "100%", height: "72vh", border: 0 }} />
        </div>
      )}

      <div className="small muted mt16" style={{ lineHeight: 1.8 }}>
        {fa
          ? "نکتهٔ رقابتی: هر میکرولرنینگ دکمهٔ «مشاهده در رفرنس» دارد و دقیقاً به همین صفحه می‌برد؛ دانشجو می‌تواند از همان‌جا فصل قبل/بعد را هم ورق بزند — درست مثل UWorld/AMBOSS."
          : "Competitive detail: every micro-lesson has a \u201CView in reference\u201D button that lands on this exact page; the student can then flip to adjacent chapters — just like UWorld/AMBOSS."}
      </div>
    </div>
  );
}
