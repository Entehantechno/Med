import { useEffect, useState, useRef } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";
import Confetti from "../../components/Confetti.jsx";
import { TYPE_MAP } from "./QuestionTypes.jsx";

/* Entry placement test: a short quiz that finds the learner's starting point.
   intro → quiz (per-question topic tag tracked) → result report + skip-ahead. */
export default function Placement({ onProfile, onBack }) {
  const { t, lang } = useApp();
  const [status, setStatus] = useState(null);
  const [phase, setPhase] = useState("intro");     // intro | quiz | done
  const [cards, setCards] = useState([]);
  const [idx, setIdx] = useState(0);
  const [sel, setSel] = useState(null);
  const [checked, setChecked] = useState(false);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [adaptive, setAdaptive] = useState(false); // adaptive one-at-a-time flow
  const [aCard, setACard] = useState(null);        // current adaptive card
  const [aTotal, setATotal] = useState(0);         // total questions in adaptive run
  const answersRef = useRef([]);

  useEffect(() => { api.get(`/learn/placement?lang=${lang}`).then(setStatus).catch(() => setStatus({ enabled: false })); }, [lang]);

  const start = async () => {
    setBusy(true);
    try {
      if (status?.adaptive) {
        // Adaptive: fetch the FIRST question only; the rest come one at a time.
        answersRef.current = []; setSel(null); setChecked(false); setIdx(0);
        const r = await api.post(`/learn/placement/next?lang=${lang}`, { history: [] });
        if (r.done || !r.card) throw new Error("no cards");
        setAdaptive(true); setACard(r.card); setATotal(r.total || status.questions); setPhase("quiz");
      } else {
        const r = await api.get(`/learn/placement/start?lang=${lang}`);
        setAdaptive(false); setCards(r.cards || []); setIdx(0); setSel(null); setChecked(false); answersRef.current = []; setPhase("quiz");
      }
    } catch { alert(lang === "fa" ? "سوالی برای آزمون موجود نیست" : "No questions available"); }
    finally { setBusy(false); }
  };
  const skip = async () => { await api.post("/learn/placement/skip", {}).catch(() => {}); onBack?.(); };

  if (!status) return <div className="card"><div className="skeleton" style={{ height: 160 }} /></div>;
  if (!status.enabled) return (
    <div className="card empty-state"><div className="ico">🧭</div><h3>{t("placementDisabled")}</h3>
      <button className="btn btn-ghost mt16" onClick={onBack}>{t("back")}</button></div>
  );

  /* ---- intro ---- */
  if (phase === "intro") {
    // if already taken, show the last result instead of re-quizzing
    const prev = status.done && status.result;
    return (
      <div className="page">
        <div className="section-title"><h2>🧭 {t("placementTitle")}</h2></div>
        {prev ? (
          <PlacementResult result={status.result} t={t} onBack={onBack} retake={status.allow_retake ? (() => start()) : null} lang={lang} />
        ) : (
          <div className="card placement-intro">
            <div className="pl-hero">🧭</div>
            <p>{status.introText || t("placementIntro").replace("{n}", status.questions)}</p>
            <ul className="ramp-rules small muted">
              <li>😌 {t("placementRuleLowStakes")}</li>
              <li>🎯 {t("placementRule2")}</li>
              <li>⏩ {t("placementRule3")}</li>
            </ul>
            <button className="btn btn-primary btn-block" disabled={busy} onClick={start}><Icon name="play" size={16} /> {t("placementStart")}</button>
            <button className="btn btn-ghost btn-block mt8" onClick={skip}>{t("placementSkip")}</button>
          </div>
        )}
      </div>
    );
  }

  /* ---- done ---- */
  if (phase === "done" && result) {
    return (
      <div className="page">
        {result.overall >= 60 && <Confetti />}
        <div className="section-title"><h2>🧭 {t("placementResult")}</h2></div>
        <PlacementResult result={result} t={t} onBack={onBack} lang={lang} />
      </div>
    );
  }

  /* ---- adaptive quiz (one question at a time) ---- */
  if (phase === "quiz" && adaptive) {
    if (!aCard) return <div className="card"><div className="skeleton" style={{ height: 160 }} /></div>;
    const Type = TYPE_MAP[aCard.type] || TYPE_MAP.mcq;
    const canCheck = Type.canCheck({ sel }, aCard);
    const done = answersRef.current.length;
    const progress = Math.round((done / (aTotal || status.questions)) * 100);
    const diffLabel = { easy: t("diffEasy"), medium: t("diffMedium"), hard: t("diffHard") }[aCard.difficulty] || aCard.difficulty;

    const check = () => {
      const right = Type.judge(aCard, { sel });
      setChecked(true); setWasCorrect(right);
      answersRef.current.push({ cardId: aCard.id, topicSlug: aCard.topicSlug, correct: right, difficulty: aCard.difficulty });
    };
    const next = async () => {
      setBusy(true);
      try {
        const r = await api.post(`/learn/placement/next?lang=${lang}`, { history: answersRef.current });
        if (r.done || !r.card) {
          const sub = await api.post(`/learn/placement/submit?lang=${lang}`, { answers: answersRef.current });
          setResult(sub.result); setPhase("done"); api.get("/learn/profile").then((d) => onProfile?.(d.profile)).catch(() => {});
        } else {
          setACard(r.card); setSel(null); setChecked(false); setIdx(idx + 1);
        }
      } catch {
        try { const sub = await api.post(`/learn/placement/submit?lang=${lang}`, { answers: answersRef.current }); setResult(sub.result); } catch { /* */ }
        setPhase("done");
      } finally { setBusy(false); }
    };
    const isLast = done + 1 >= (aTotal || status.questions);
    return (
      <div className="lesson-wrap">
        <div className="lesson-top">
          <button className="btn btn-ghost btn-sm icon-btn" onClick={onBack} title={t("back")}><Icon name="logout" size={16} /></button>
          <div className="pbar"><span style={{ width: `${progress}%` }} /></div>
          <span className="hud-chip" style={{ fontSize: ".95rem" }}>{done + 1}/{aTotal || status.questions}</span>
        </div>
        <div className="small muted center">🧭 {t("placementTitle")} · <span className="tag small">{aCard.topicName}</span>
          {" · "}<span className={`tag small diff-${aCard.difficulty}`} title={t("placementAdaptiveHint")}>{diffLabel}</span></div>
        <div className="lesson-q">{aCard.q}</div>
        {aCard.image && <img src={aCard.image} alt="" className="ddle-img" style={{ maxHeight: 200, margin: "0 auto 16px", display: "block" }} />}
        <Type card={aCard} checked={checked} sel={sel} setSel={setSel} isCorrect={wasCorrect} />
        {checked && (
          <div className={`lesson-fb ${wasCorrect ? "ok" : "bad"}`}>
            <Icon name={wasCorrect ? "check" : "warn"} size={18} /> {wasCorrect ? t("correct") : t("wrong")}
          </div>
        )}
        <div className="mt16">
          {!checked
            ? <button className="btn btn-primary btn-block" disabled={!canCheck} onClick={check}>{t("checkAns")}</button>
            : <button className="btn btn-accent btn-block" disabled={busy} onClick={next}>{isLast ? t("placementFinish") : t("nextQ")}</button>}
        </div>
      </div>
    );
  }

  /* ---- quiz (classic fixed set) ---- */
  if (!cards.length) return <div className="card empty-state"><h3>{t("back")}</h3></div>;
  const card = cards[idx];
  const Type = TYPE_MAP[card.type] || TYPE_MAP.mcq;
  const canCheck = Type.canCheck({ sel }, card);
  const progress = Math.round((idx / cards.length) * 100);

  const check = () => {
    const right = Type.judge(card, { sel });
    setChecked(true); setWasCorrect(right);
    answersRef.current.push({ topicSlug: card.topicSlug, correct: right });
  };
  const next = async () => {
    if (idx + 1 < cards.length) { setIdx(idx + 1); setSel(null); setChecked(false); return; }
    // submit
    try { const r = await api.post(`/learn/placement/submit?lang=${lang}`, { answers: answersRef.current }); setResult(r.result); setPhase("done"); api.get("/learn/profile").then((d) => onProfile?.(d.profile)).catch(() => {}); }
    catch { setPhase("done"); }
  };

  return (
    <div className="lesson-wrap">
      <div className="lesson-top">
        <button className="btn btn-ghost btn-sm icon-btn" onClick={onBack} title={t("back")}><Icon name="logout" size={16} /></button>
        <div className="pbar"><span style={{ width: `${progress}%` }} /></div>
        <span className="hud-chip" style={{ fontSize: ".95rem" }}>{idx + 1}/{cards.length}</span>
      </div>
      <div className="small muted center">🧭 {t("placementTitle")} · <span className="tag small">{card.topicName}</span></div>
      <div className="lesson-q">{card.q}</div>
      {card.image && <img src={card.image} alt="" className="ddle-img" style={{ maxHeight: 200, margin: "0 auto 16px", display: "block" }} />}
      <Type card={card} checked={checked} sel={sel} setSel={setSel} isCorrect={wasCorrect} />
      {checked && (
        <div className={`lesson-fb ${wasCorrect ? "ok" : "bad"}`}>
          <Icon name={wasCorrect ? "check" : "warn"} size={18} /> {wasCorrect ? t("correct") : t("wrong")}
        </div>
      )}
      <div className="mt16">
        {!checked
          ? <button className="btn btn-primary btn-block" disabled={!canCheck} onClick={check}>{t("checkAns")}</button>
          : <button className="btn btn-accent btn-block" onClick={next}>{idx + 1 < cards.length ? t("nextQ") : t("placementFinish")}</button>}
      </div>
    </div>
  );
}

function PlacementResult({ result, t, onBack, retake, lang }) {
  const levelLabel = { beginner: t("placementBeginner"), intermediate: t("placementIntermediate"), advanced: t("placementAdvanced") }[result.level] || result.level;
  return (
    <>
      <div className="card center mb16">
        <div style={{ fontSize: 48 }}>🧭</div>
        <div className="big">{result.overall}%</div>
        <div className="tag" style={{ fontSize: ".9rem" }}>{t("placementLevel")}: {levelLabel}</div>
        {result.skippedLessons > 0 && <div className="small mt8" style={{ color: "var(--green)" }}>⏩ {t("placementSkipped").replace("{n}", result.skippedLessons)}</div>}
        {result.unlockedTopics > 0 && <div className="small mt8" style={{ color: "var(--green)" }}>🔓 {t("placementUnlocked").replace("{n}", result.unlockedTopics)}</div>}
      </div>
      <div className="card">
        <div className="section-title"><h4>{t("placementByTopic")}</h4></div>
        {result.perTopic.map((tp) => (
          <div className="weak-row" key={tp.slug}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{tp.name} {tp.strong && <span className="tag small" style={{ color: "var(--green)" }}>💪 {t("placementStrong")}</span>}</div>
              <div className="pbar sm"><span style={{ width: `${tp.accuracy}%`, background: tp.strong ? "var(--green)" : tp.accuracy < 40 ? "var(--flame)" : "var(--gold)" }} /></div>
            </div>
            <span className="tag">{tp.accuracy}%</span>
          </div>
        ))}
      </div>
      <button className="btn btn-primary btn-block mt16" onClick={onBack}><Icon name="check" size={16} /> {t("placementGoLearn")}</button>
      {retake && <button className="btn btn-ghost btn-block mt8" onClick={retake}>{t("placementRetake")}</button>}
    </>
  );
}
