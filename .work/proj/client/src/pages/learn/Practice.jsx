import { useEffect, useState, useRef } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";
import Confetti from "../../components/Confetti.jsx";
import StatNum from "../../components/StatNum.jsx";
import { TYPE_MAP } from "./QuestionTypes.jsx";
import { playCorrect, playWrong, playFanfare, playComplete } from "../../lib/feedback.js";

/* Smart Practice Hub (UWorld-style): a targeted session built from the learner's
   own weak topics + mistakes + due reviews + hardest questions. Shows a weak-area
   report on the landing screen, then plays a mixed session with a source tag. */
const SOURCE_META = {
  weak: { fa: "نقطهٔ ضعف", en: "Weak spot", emoji: "🎯" },
  mistakes: { fa: "اشتباه قبلی", en: "Past mistake", emoji: "❌" },
  due: { fa: "مرور امروز", en: "Due review", emoji: "🔁" },
  hardest: { fa: "سخت‌ترین‌ها", en: "Hardest", emoji: "🔥" },
};

export default function Practice({ onProfile, onBack }) {
  const { t, lang } = useApp();
  const [summary, setSummary] = useState(null);
  const [phase, setPhase] = useState("intro");   // intro | play | done
  const [cards, setCards] = useState([]);
  const [idx, setIdx] = useState(0);
  const [sel, setSel] = useState(null);
  const [checked, setChecked] = useState(false);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [busy, setBusy] = useState(false);
  const startRef = useRef(Date.now());

  const load = () => api.get(`/learn/practice?lang=${lang}`).then(setSummary).catch(() => setSummary({ enabled: false }));
  useEffect(() => { load(); }, [lang]);

  const start = async () => {
    setBusy(true);
    try {
      const r = await api.post("/learn/practice/start", {});
      setCards(r.cards || []); setIdx(0); setSel(null); setChecked(false); setCorrect(0);
      startRef.current = Date.now(); setPhase("play");
    } catch { alert(lang === "fa" ? "هنوز داده‌ای برای تمرین نیست — چند درس بزن!" : "No data to practice yet — do a few lessons!"); }
    finally { setBusy(false); }
  };

  if (!summary) return <div className="card"><div className="skeleton" style={{ height: 180 }} /></div>;
  if (!summary.enabled) return (
    <div className="card empty-state"><div className="ico">🎯</div><h3>{t("practiceDisabled")}</h3>
      <button className="btn btn-ghost mt16" onClick={onBack}>{t("back")}</button></div>
  );

  /* ---------- landing ---------- */
  if (phase === "intro") {
    const c = summary.counts || {};
    const cards4 = [
      ["weak", c.weak], ["mistakes", c.mistakes], ["due", c.due], ["hardest", c.hardest],
    ];
    return (
      <div className="page">
        <div className="section-title"><h2><Icon name="target" size={22} /> {t("smartPractice")}</h2></div>
        <div className="muted small mb16">{t("practiceHint")}</div>

        <div className="grid grid-2 mb16">
          {cards4.map(([k, n]) => (
            <div key={k} className="card practice-source">
              <div className="ps-emoji">{SOURCE_META[k].emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800 }}>{lang === "fa" ? SOURCE_META[k].fa : SOURCE_META[k].en}</div>
                <div className="small muted">{n || 0} {t("cardsAvailable")}</div>
              </div>
            </div>
          ))}
        </div>

        {/* weak-topic report (UWorld-style) */}
        {summary.weakTopics?.length > 0 && (
          <div className="card mb16">
            <div className="section-title"><h4>📉 {t("weakTopicsReport")}</h4></div>
            {summary.weakTopics.map((w) => (
              <div className="weak-row" key={w.node_id}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{w.title}</div>
                  <div className="pbar sm"><span style={{ width: `${w.accuracy}%`, background: w.accuracy < 50 ? "var(--flame)" : "var(--gold)" }} /></div>
                </div>
                <span className="tag" style={{ color: w.accuracy < 50 ? "var(--danger)" : "var(--muted)" }}>{w.accuracy}% · {w.answered}</span>
              </div>
            ))}
          </div>
        )}

        {summary.hasData
          ? <button className="btn btn-primary btn-block" disabled={busy} onClick={start}>
              <Icon name="play" size={16} /> {t("practiceStart").replace("{n}", summary.sessionSize)}
            </button>
          : <div className="card empty-state"><div className="ico">✅</div><h3>{t("practiceNoData")}</h3>
              <div className="small muted">{t("practiceNoDataHint")}</div></div>}
        <button className="btn btn-ghost btn-block mt8" onClick={onBack}>{t("back")}</button>
      </div>
    );
  }

  /* ---------- done ---------- */
  if (phase === "done") {
    const acc = cards.length ? Math.round((correct / cards.length) * 100) : 0;
    return (
      <div className="lesson-wrap">
        {acc >= 80 && <Confetti />}
        <div className="celebrate card">
          <div style={{ fontSize: 54 }}>🎯</div>
          <h2 style={{ border: "none" }}>{t("practiceDone")}</h2>
          <div className="big"><StatNum value={correct} duration={1000} />/{cards.length}</div>
          <div className="small muted"><StatNum value={acc} duration={1000} delay={300} />% {t("accuracy")}</div>
        </div>
        <button className="btn btn-accent btn-block mt16" onClick={() => { load(); setPhase("intro"); }}><Icon name="repeat" size={16} /> {t("practiceAgain")}</button>
        <button className="btn btn-primary btn-block mt8" onClick={onBack}><Icon name="check" size={16} /> {t("back")}</button>
      </div>
    );
  }

  /* ---------- play ---------- */
  if (!cards.length) return <div className="card empty-state"><h3>{t("back")}</h3></div>;
  const card = cards[idx];
  const Type = TYPE_MAP[card.type] || TYPE_MAP.mcq;
  const canCheck = Type.canCheck({ sel }, card);
  const progress = Math.round((idx / cards.length) * 100);
  const src = SOURCE_META[card.source] || SOURCE_META.weak;

  const check = async () => {
    const right = Type.judge(card, { sel });
    setChecked(true); setWasCorrect(right);
    if (right) { setCorrect((n) => n + 1); playCorrect(); } else { playWrong(); }
    try { const r = await api.post("/learn/practice/answer", { cardId: card.id, correct: right, sel, responseMs: Date.now() - startRef.current }); if (r.profile) onProfile?.(r.profile); } catch { /* */ }
  };
  const next = () => {
    if (idx + 1 < cards.length) { setIdx(idx + 1); setSel(null); setChecked(false); startRef.current = Date.now(); }
    else {
      // celebrate the session: a fanfare for a strong run (≥80%), else a soft finish.
      const acc = cards.length ? Math.round((correct / cards.length) * 100) : 0;
      if (acc >= 80) playFanfare(); else playComplete();
      setPhase("done");
    }
  };

  return (
    <div className="lesson-wrap">
      <div className="lesson-top">
        <button className="btn btn-ghost btn-sm icon-btn" onClick={onBack} title={t("back")}><Icon name="logout" size={16} /></button>
        <div className="pbar"><span style={{ width: `${progress}%` }} /></div>
        <span className="hud-chip" style={{ fontSize: ".95rem" }}>🎯 {correct}/{cards.length}</span>
      </div>
      <div className="small muted center">
        {idx + 1} {t("of")} {cards.length} · <span className="tag small">{src.emoji} {lang === "fa" ? src.fa : src.en}</span>
      </div>
      <div className="lesson-q">{card.q}</div>
      {card.image && <img src={card.image} alt="" className="ddle-img" style={{ maxHeight: 200, margin: "0 auto 16px", display: "block" }} />}
      <Type card={card} checked={checked} sel={sel} setSel={setSel} isCorrect={wasCorrect} />
      {checked && (
        <>
          <div className={`lesson-fb ${wasCorrect ? "ok" : "bad"}`}>
            <Icon name={wasCorrect ? "check" : "warn"} size={18} /> {wasCorrect ? t("correct") : t("wrong")}
          </div>
          {card.micro && <MicroInline micro={card.micro} />}
        </>
      )}
      <div className="mt16">
        {!checked
          ? <button className="btn btn-primary btn-block" disabled={!canCheck} onClick={check}>{t("checkAns")}</button>
          : <button className="btn btn-accent btn-block" onClick={next}>{idx + 1 < cards.length ? t("nextQ") : t("lessonComplete")}</button>}
      </div>
    </div>
  );
}

/* tiny inline درسنامه (hand-written, no AI) shown after a wrong practice answer */
function MicroInline({ micro }) {
  const { t } = useApp();
  if (!micro) return null;
  return (
    <div className="micro-box small mt8" style={{ padding: "10px 14px" }}>
      <b>📘 {t("whyLesson") || "درسنامه"}</b>
      <div style={{ marginTop: 4 }}>{typeof micro === "string" ? micro : (micro.body || micro.text || "")}</div>
    </div>
  );
}
