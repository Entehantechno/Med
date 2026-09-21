import { useEffect, useState } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";

/* Learner's saved notes & highlighted cards. */
export default function Notes({ onBack }) {
  const { t } = useApp();
  const [notes, setNotes] = useState(null);
  const load = () => api.get("/learn/notes").then((d) => setNotes(d.notes)).catch(() => setNotes([]));
  useEffect(() => { load(); }, []);
  if (!notes) return <div className="card"><div className="skeleton" style={{ height: 140 }} /></div>;

  const save = async (cardId, note, highlight) => {
    await api.put(`/learn/notes/${cardId}`, { note, highlight });
    load();
  };

  return (
    <div className="page">
      <div className="section-title"><h2><Icon name="edit" size={22} /> {t("myNotes")}</h2>
        {onBack && <button className="btn btn-ghost btn-sm" onClick={onBack}>← {t("back")}</button>}</div>
      {notes.length === 0
        ? <div className="card empty-state"><div className="ico"><Icon name="edit" size={40} /></div>
            <h3>{t("noNotes")}</h3><div className="small muted">{t("noNotesHint")}</div></div>
        : notes.map((n) => (
          <div className="card mb8" key={n.card_id}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
              <div style={{ fontWeight: 700, flex: 1, minWidth: 0 }}>{n.question}</div>
              <button className={`btn btn-sm ${n.highlight ? "btn-accent" : "btn-ghost"}`}
                onClick={() => save(n.card_id, n.note, !n.highlight)} title={t("highlight")}>
                <Icon name="star" size={14} />
              </button>
            </div>
            {n.note && <div className="note-body small mt8">{n.note}</div>}
          </div>
        ))}
    </div>
  );
}

/* Reusable inline note/highlight editor for a single card (used in lessons/review). */
export function NoteButton({ cardId }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [highlight, setHighlight] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const openEditor = async () => {
    if (!loaded) {
      try { const d = await api.get(`/learn/notes/${cardId}`); setNote(d.note || ""); setHighlight(!!d.highlight); } catch { /* */ }
      setLoaded(true);
    }
    setOpen(true);
  };
  const save = async () => { await api.put(`/learn/notes/${cardId}`, { note, highlight }); setOpen(false); };

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={openEditor} title={t("addNote")}>
        <Icon name="edit" size={14} /> {t("note")}
      </button>
      {open && (
        <div className="modal-back" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="modal" style={{ width: "min(440px,96vw)" }}>
            <h3><Icon name="edit" size={16} /> {t("myNotes")}</h3>
            <label className="toggle-row" style={{ marginBottom: 12 }}>
              <span><Icon name="star" size={15} /> {t("highlight")}</span>
              <input type="checkbox" checked={highlight} onChange={(e) => setHighlight(e.target.checked)} />
            </label>
            <textarea style={{ minHeight: 100 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("notePlaceholder")} />
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>{t("close")}</button>
              <button className="btn btn-primary" onClick={save}>{t("save")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
