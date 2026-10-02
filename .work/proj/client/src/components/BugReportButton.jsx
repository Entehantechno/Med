import { useState } from "react";
import { useApp } from "../context.jsx";
import { api } from "../api.js";

export default function BugReportButton({ cardId, size = "sm" }) {
  const { lang } = useApp();
  const fa = lang === "fa";
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!title.trim() || !desc.trim() || sending) return;
    setSending(true);
    try {
      await api.post("/learn/bug-report", { title: title.trim(), description: desc.trim(), severity, meta: cardId ? { cardId } : {} });
      setDone(true);
      setTimeout(() => { setOpen(false); setDone(false); setTitle(""); setDesc(""); }, 2000);
    } catch (e) {
      alert(e.message || "خطا");
    } finally { setSending(false); }
  };

  if (!open) {
    return (
      <button type="button" className={`btn btn-ghost btn-${size}`} onClick={() => setOpen(true)} title={fa ? "گزارش باگ یا پیشنهاد" : "Report a bug"}>
        🐛 {fa ? "گزارش باگ" : "Report bug"}
      </button>
    );
  }

  return (
    <div className="card" style={{ padding: 12, minWidth: 260, maxWidth: 360 }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>{fa ? "گزارش باگ" : "Report a bug"} {cardId ? `#${cardId}` : ""}</div>
      <input className="input" placeholder={fa ? "عنوان کوتاه" : "Short title"} value={title} onChange={e => setTitle(e.target.value)} maxLength={200} />
      <textarea className="input mt8" rows={3} placeholder={fa ? "شرح کامل" : "Description"} value={desc} onChange={e => setDesc(e.target.value)} maxLength={5000} />
      <div className="mt8" style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <select className="input" value={severity} onChange={e => setSeverity(e.target.value)} style={{ maxWidth: 130 }}>
          <option value="low">low</option><option value="medium">medium</option><option value="high">high</option><option value="critical">critical</option>
        </select>
        <button className="btn btn-primary btn-sm" onClick={submit} disabled={sending || done}>{done ? "✓" : (fa ? "ارسال" : "Send")}</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>{fa ? "انصراف" : "Cancel"}</button>
      </div>
      {done && <div className="small" style={{ color: "var(--green)", marginTop: 6 }}>{fa ? "گزارش ثبت شد — متشکریم!" : "Report sent — thanks!"}</div>}
    </div>
  );
}
