import { useState, useRef } from "react";
import { useApp } from "../../context.jsx";
import { api, getToken } from "../../api.js";
import { Modal, useToast } from "../../components/UI.jsx";
import Icon from "../../components/Icon.jsx";

/* Guided CSV importer for pre-internship questions. Redesigned for first-time
   admins: a clear 3-step flow (download → fill → upload), a plain-language
   column guide, a valid-topic chip list, and a per-row "here's what the site
   understood" preview so admins can VERIFY before committing. */
export default function ImportModal({ onClose, onDone }) {
  const { t, lang } = useApp();
  const toast = useToast();
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [attach, setAttach] = useState(true);
  const [showGuide, setShowGuide] = useState(true);
  const fileRef = useRef(null);
  const fa = lang === "fa";

  const onFile = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { setCsv(String(r.result || "")); setPreview(null); };
    r.readAsText(f, "utf-8");
  };
  const download = (path, name) => {
    fetch(path, { credentials: "same-origin", headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => r.blob()).then((b) => {
        const url = URL.createObjectURL(b); const a = document.createElement("a");
        a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
      });
  };
  const doPreview = async () => {
    if (!csv.trim()) { toast(t("pasteOrUpload")); return; }
    setBusy(true);
    try { setPreview(await api.post(`/admin/content/import/preview?lang=${lang}`, { csv })); }
    catch (e) { toast(e.message); } finally { setBusy(false); }
  };
  const doImport = async () => {
    setBusy(true);
    try { const r = await api.post("/admin/content/import", { csv, attachToPath: attach }); toast(`${t("imported")}: ${r.imported}`); onDone(); }
    catch (e) { toast(e.message); setBusy(false); }
  };

  const TYPE_LABEL = fa
    ? { mcq: "چهارگزینه‌ای", truefalse: "درست/غلط", fill: "جای خالی", match: "تطبیق", order: "مرتب‌سازی" }
    : { mcq: "Multiple choice", truefalse: "True/False", fill: "Fill blank", match: "Match", order: "Order" };

  return (
    <Modal title={t("bulkImport")} onClose={onClose} wide>
      {/* ---- Step 1: guided intro (collapsible) ---- */}
      <div className="import-guide">
        <button className="import-guide-head" onClick={() => setShowGuide((s) => !s)}>
          <span><Icon name="bulb" size={16} /> {t("importHowTitle")}</span>
          <Icon name={showGuide ? "chevronUp" : "chevronDown"} size={16} />
        </button>
        {showGuide && (
          <div className="import-guide-body">
            <ol className="import-steps">
              <li><b>۱.</b> {t("importStep1")}</li>
              <li><b>۲.</b> {t("importStep2")}</li>
              <li><b>۳.</b> {t("importStep3")}</li>
            </ol>
            <div className="import-cols">
              <div className="small muted mb8">{t("importColsTitle")}</div>
              <table className="import-col-table">
                <tbody>
                  <tr><td><code>type</code></td><td>{t("importColType")}</td></tr>
                  <tr><td><code>topic</code></td><td>{t("importColTopic")}</td></tr>
                  <tr><td><code>question</code></td><td>{t("importColQuestion")}</td></tr>
                  <tr><td><code>options</code></td><td>{t("importColOptions")}</td></tr>
                  <tr><td><code>correct</code></td><td>{t("importColCorrect")}</td></tr>
                </tbody>
              </table>
              <div className="small muted mt8">💡 {t("importTip")}</div>
            </div>
          </div>
        )}
      </div>

      {/* ---- Step 2: download templates ---- */}
      <div className="import-actions">
        <button className="btn btn-primary btn-sm" onClick={() => download("/api/admin/content/import/simple.csv", "simple_questions.csv")}>
          <Icon name="download" size={14} /> {t("importSimpleTemplate")}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => download("/api/admin/content/import/template.csv", "full_template.csv")}>
          <Icon name="download" size={14} /> {t("importFullTemplate")}
        </button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: "none" }} />
        <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}><Icon name="upload" size={14} /> {t("chooseFile")}</button>
      </div>

      {/* ---- Step 3: paste / edit ---- */}
      <div className="field">
        <label>{t("csvContent")}</label>
        <textarea value={csv} onChange={(e) => { setCsv(e.target.value); setPreview(null); }}
          style={{ minHeight: 110, fontFamily: "monospace", fontSize: ".82rem", direction: "ltr" }}
          placeholder={"type,topic,question,options,correct\nmcq,gi,...,\"a | b | c\",1"} />
      </div>
      <label className="toggle-row" style={{ cursor: "pointer" }}>
        <span>{t("attachToPath")} <span className="small muted">— {t("attachToPathHint")}</span></span>
        <input type="checkbox" checked={attach} onChange={(e) => setAttach(e.target.checked)} style={{ width: 18, height: 18 }} />
      </label>

      {/* ---- Preview: what the site understood ---- */}
      {preview && (
        <div className="card mt16" style={{ background: "var(--panel2)" }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>
            {t("valid")}: <span style={{ color: "var(--green)" }}>{preview.valid}</span> / {preview.total}
            {preview.errors.length > 0 && <span style={{ color: "var(--danger)" }}> · {t("errors")}: {preview.errors.length}</span>}
          </div>

          {/* valid topic slugs — so the admin can copy exact values */}
          {preview.validTopics?.length > 0 && (
            <div className="mb8">
              <div className="small muted mb8">{t("importValidTopics")}</div>
              <div className="import-topic-chips">
                {preview.validTopics.map((tp) => <span key={tp.slug} className="tag" title={tp.name}><code>{tp.slug}</code> · {tp.name}</span>)}
              </div>
            </div>
          )}

          {/* per-row echo so admins VERIFY the site read each row correctly */}
          <div className="small muted mb8">{t("importUnderstood")}</div>
          <div className="import-preview-rows">
            {(preview.rows || []).map((r) => (
              <div key={r.row} className={`import-prow ${r.ok ? "" : "bad"}`}>
                <span className="ip-num">{r.row}</span>
                {r.ok ? (
                  <div className="ip-body">
                    <div className="ip-top"><span className="tag">{TYPE_LABEL[r.type] || r.type}</span>{r.topic && <span className="tag">{r.topic}</span>}<b className="ip-q">{r.question}</b></div>
                    {r.detail && <div className="ip-detail small">{r.detail}</div>}
                  </div>
                ) : (
                  <div className="ip-body ip-err">⚠️ {r.error}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>{t("cancel")}</button>
        {!preview
          ? <button className="btn btn-primary" disabled={busy} onClick={doPreview}><Icon name="search" size={14} /> {t("previewImport")}</button>
          : <button className="btn btn-accent" disabled={busy || preview.valid === 0} onClick={doImport}>
              <Icon name="check" size={14} /> {t("importN").replace("{n}", preview.valid)}
            </button>}
      </div>
    </Modal>
  );
}
