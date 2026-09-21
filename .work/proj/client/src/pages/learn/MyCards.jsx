import { useEffect, useState } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";
import { Modal } from "../../components/UI.jsx";
import { TYPE_MAP, MicroLesson } from "./QuestionTypes.jsx";

export default function MyCards() {
  const { t, lang } = useApp();
  const [cards, setCards] = useState(null);
  const [editing, setEditing] = useState(false);
  const [practice, setPractice] = useState(null);

  const load = () => api.get(`/learn/mycards?lang=${lang}`).then((d) => setCards(d.cards)).catch(() => setCards([]));
  useEffect(() => { load(); }, [lang]);

  const del = async (linkId) => { await api.del(`/learn/mycards/${linkId}`); load(); };
  const startPractice = async () => {
    const d = await api.get(`/learn/mycards/practice?lang=${lang}`);
    if (d.cards?.length) setPractice(d.cards);
  };

  if (practice) return <PracticeMine cards={practice} onDone={() => setPractice(null)} />;
  if (!cards) return <div className="card"><div className="skeleton" style={{ height: 200 }} /></div>;

  return (
    <div className="page">
      <div className="section-title"><h2><Icon name="edit" size={22} /> {t("myCards")}</h2>
        <div style={{ display: "flex", gap: 8 }}>
          {cards.length > 0 && <button className="btn btn-ghost btn-sm" onClick={startPractice}><Icon name="play" size={14} /> {t("practiceMine")}</button>}
          <button className="btn btn-primary btn-sm" onClick={() => setEditing(true)}><Icon name="edit" size={14} /> {t("createCard")}</button>
        </div>
      </div>

      {cards.length === 0 && <div className="card empty-state"><div className="ico"><Icon name="edit" size={40} /></div><h3>{t("noMyCards")}</h3></div>}
      {cards.map((c) => (
        <div key={c.linkId} className="card" style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700 }}>{c.q}</div>
            <div className="small muted">{c.hints.length} {t("hints")}</div>
          </div>
          <button className="btn btn-danger btn-sm" onClick={() => del(c.linkId)}><Icon name="trash" size={13} /></button>
        </div>
      ))}

      {editing && <CardBuilder onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} />}
    </div>
  );
}

function CardBuilder({ onClose, onSaved }) {
  const { t, lang } = useApp();
  const [q_fa, setQfa] = useState("");
  const [options, setOptions] = useState([{ fa: "", correct: true }, { fa: "", correct: false }, { fa: "", correct: false }]);
  const [hints, setHints] = useState([""]);
  const [ex, setEx] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const setOpt = (i, v) => setOptions((o) => o.map((x, j) => j === i ? { ...x, fa: v } : x));
  const setCorrect = (i) => setOptions((o) => o.map((x, j) => ({ ...x, correct: j === i })));
  const addOpt = () => setOptions((o) => [...o, { fa: "", correct: false }]);
  const setHint = (i, v) => setHints((h) => h.map((x, j) => j === i ? v : x));
  const addHint = () => setHints((h) => [...h, ""]);

  const save = async () => {
    setErr("");
    const opts = options.filter((o) => o.fa.trim()).map((o) => ({ fa: o.fa, en: o.fa, correct: o.correct }));
    if (!q_fa.trim()) { setErr(t("cardQuestion")); return; }
    if (opts.length < 2) { setErr(t("needTwoOpts")); return; }
    if (!opts.some((o) => o.correct)) { setErr(t("markCorrectOne")); return; }
    setBusy(true);
    try {
      await api.post("/learn/mycards", {
        q_fa, q_en: q_fa, options: opts,
        hints_fa: hints.filter(Boolean), hints_en: hints.filter(Boolean),
        ex_fa: ex, ex_en: ex,
      });
      onSaved();
    } catch (e) { setErr(e.message); setBusy(false); }
  };

  return (
    <Modal title={t("createCard")} onClose={onClose} onSave={save} saveLabel={busy ? "…" : t("saveCard")}>
      {err && <div className="err-banner mb8">{err}</div>}
      <div className="field"><label>{t("cardQuestion")}</label>
        <textarea value={q_fa} onChange={(e) => setQfa(e.target.value)} /></div>

      <div className="section-title"><label className="small muted">{t("options")} — {t("markCorrectOne")}</label>
        <button type="button" className="btn btn-sm btn-ghost" onClick={addOpt}>+ {t("add")}</button></div>
      {options.map((o, i) => (
        <div key={i} className="inline-form mt8" style={{ alignItems: "center" }}>
          <input type="radio" name="mycorrect" checked={o.correct} onChange={() => setCorrect(i)} style={{ width: 18, flexShrink: 0 }} />
          <input placeholder={`#${i + 1}`} value={o.fa} onChange={(e) => setOpt(i, e.target.value)} />
        </div>
      ))}

      <div className="divider" />
      <div className="section-title"><label className="small muted">{t("cardHints")}</label>
        <button type="button" className="btn btn-sm btn-ghost" onClick={addHint}>+ {t("cardAddHint")}</button></div>
      {hints.map((h, i) => (
        <div key={i} className="field mt8"><input placeholder={`${t("hint")} ${i + 1}`} value={h} onChange={(e) => setHint(i, e.target.value)} /></div>
      ))}

      <div className="divider" />
      <div className="field"><label>{t("cardExplain")}</label>
        <textarea value={ex} onChange={(e) => setEx(e.target.value)} /></div>
    </Modal>
  );
}

/* Practice my own cards: shows hints progressively before the answer. */
function PracticeMine({ cards, onDone }) {
  const { t, lang } = useApp();
  const [idx, setIdx] = useState(0);
  const [sel, setSel] = useState(null);
  const [checked, setChecked] = useState(false);
  const [shownHints, setShownHints] = useState(0);
  const card = cards[idx];
  const Type = TYPE_MAP[card.type] || TYPE_MAP.mcq;

  const check = () => setChecked(true);
  const next = () => {
    if (idx + 1 < cards.length) { setIdx(idx + 1); setSel(null); setChecked(false); setShownHints(0); }
    else onDone();
  };

  return (
    <div className="page">
      <div className="section-title"><h2><Icon name="play" size={22} /> {t("practiceMine")}</h2>
        <button className="btn btn-ghost btn-sm" onClick={onDone}>{t("back")}</button></div>
      <div className="lesson-wrap">
        <div className="pbar mb16"><span style={{ width: `${Math.round((idx / cards.length) * 100)}%` }} /></div>
        <div className="lesson-q">{card.q}</div>

        {/* progressive hints */}
        {card.hints?.slice(0, shownHints).map((h, i) => (
          <div className="ddle-question ddle-hint" key={i}><span className="ddle-hint-label">{t("hint")} {i + 1}:</span> {h}</div>
        ))}

        <Type card={card} checked={checked} sel={sel} setSel={setSel} />

        {checked && card.micro && <MicroLesson micro={card.micro} defaultOpen={true} />}

        <div className="mt16" style={{ display: "flex", gap: 8 }}>
          {!checked && card.hints?.length > shownHints && (
            <button className="btn btn-ghost" onClick={() => setShownHints((n) => n + 1)}><Icon name="bulb" size={16} /> {t("hint")}</button>
          )}
          {!checked
            ? <button className="btn btn-primary" style={{ flex: 1 }} disabled={!Type.canCheck({ sel }, card)} onClick={check}>{t("checkAns")}</button>
            : <button className="btn btn-accent" style={{ flex: 1 }} onClick={next}>{idx + 1 < cards.length ? t("nextQ") : t("reviewDone")}</button>}
        </div>
      </div>
    </div>
  );
}
