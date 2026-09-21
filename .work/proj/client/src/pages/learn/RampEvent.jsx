import { useEffect, useState, useRef } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";
import Confetti from "../../components/Confetti.jsx";
import { TYPE_MAP } from "./QuestionTypes.jsx";

/* XP Ramp-Up — a timed blitz event (Duolingo-style "Events"): answer as many
   questions as you can before the timer runs out, earn bonus XP per correct
   answer plus a flawless-run bonus. Admin controls length / reward / on-off. */
export default function RampEvent({ onProfile, onBack }) {
  const { t, lang } = useApp();
  const [def, setDef] = useState(null);
  const [phase, setPhase] = useState("intro"); // intro | play | done
  const [run, setRun] = useState(null);         // { runId, duration_s, cards }
  const [idx, setIdx] = useState(0);
  const [sel, setSel] = useState(null);
  const [checked, setChecked] = useState(false);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [left, setLeft] = useState(0);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const timerRef = useRef(null);
  const finishedRef = useRef(false);

  useEffect(() => { api.get(`/learn/event?lang=${lang}`).then(setDef).catch(() => setDef({ enabled: false })); }, [lang]);

  // countdown timer during play
  useEffect(() => {
    if (phase !== "play") return;
    timerRef.current = setInterval(() => {
      setLeft((s) => {
        if (s <= 1) { clearInterval(timerRef.current); finish(correctRef.current); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // keep a ref of current correct count so the timer callback sees the latest
  const correctRef = useRef(0);
  useEffect(() => { correctRef.current = correct; }, [correct]);

  const start = async () => {
    setBusy(true);
    try {
      const r = await api.post("/learn/event/start", {});
      finishedRef.current = false;
      setRun(r); setLeft(r.duration_s); setIdx(0); setSel(null); setChecked(false); setCorrect(0);
      correctRef.current = 0; setResult(null); setPhase("play");
    } catch (e) { alert(lang === "fa" ? "کارتی برای این چالش موجود نیست" : "No cards available"); }
    finally { setBusy(false); }
  };

  const finish = async (finalCorrect) => {
    if (finishedRef.current || !run) return;
    finishedRef.current = true;
    clearInterval(timerRef.current);
    try {
      const r = await api.post(`/learn/event/${run.runId}/finish`, { correct: finalCorrect });
      setResult(r); onProfile?.(r.profile); setPhase("done");
    } catch (e) { setPhase("done"); }
  };

  if (!def) return <div className="card"><div className="skeleton" style={{ height: 160 }} /></div>;
  if (!def.enabled) return (
    <div className="card empty-state"><div className="ico">🎯</div>
      <h3>{t("eventDisabled")}</h3>
      <button className="btn btn-ghost mt16" onClick={onBack}>{t("back")}</button></div>
  );

  if (phase === "intro") return (
    <div className="page">
      <div className="section-title"><h2>⚡ {def.title}</h2></div>
      <div className="card ramp-intro">
        <div className="ramp-hero">⚡</div>
        <p>{t("eventIntro").replace("{q}", def.questions).replace("{s}", Math.round(def.duration_s / 60 * 10) / 10)}</p>
        <ul className="ramp-rules small muted">
          <li>⏱️ {t("eventTime")}: {def.duration_s} {t("seconds")}</li>
          <li>➕ {t("eventPerCorrect")}: +{def.xp_per_correct} XP</li>
          <li>🏆 {t("eventFlawless")}: +{def.bonus_all_correct} XP</li>
        </ul>
        <button className="btn btn-primary btn-block" disabled={busy} onClick={start}>
          <Icon name="play" size={16} /> {t("eventStart")}
        </button>
        <button className="btn btn-ghost btn-block mt8" onClick={onBack}>{t("back")}</button>
      </div>
    </div>
  );

  if (phase === "done" && result) {
    const flawless = result.flawless;
    return (
      <div className="lesson-wrap">
        {flawless && <Confetti />}
        <div className="celebrate card">
          <div style={{ color: "var(--xp)" }}>⚡</div>
          <h2 style={{ border: "none" }}>{t("eventDone")}</h2>
          <div className="big">+{result.xp} {t("xp")}</div>
          <div className="reward-chips">
            <div className="reward-chip"><div className="rv" style={{ color: "var(--green)" }}>{result.correct}/{result.total}</div><div className="small muted">{t("correct")}</div></div>
            {flawless && <div className="reward-chip"><div className="rv" style={{ color: "var(--gold)" }}>🏆</div><div className="small muted">{t("eventFlawless")}</div></div>}
          </div>
        </div>
        <button className="btn btn-accent btn-block mt16" onClick={() => setPhase("intro")}><Icon name="repeat" size={16} /> {t("tryAgain")}</button>
        <button className="btn btn-primary btn-block mt8" onClick={onBack}><Icon name="check" size={16} /> {t("continueLearning")}</button>
      </div>
    );
  }

  // play phase
  const cards = run?.cards || [];
  if (!cards.length) return <div className="card empty-state"><h3>{t("back")}</h3></div>;
  const card = cards[idx % cards.length];
  const Type = TYPE_MAP[card.type] || TYPE_MAP.mcq;
  const canCheck = Type.canCheck({ sel }, card);
  const timePct = Math.round((left / (run.duration_s || 1)) * 100);

  const check = () => {
    const right = Type.judge(card, { sel });
    setChecked(true); setWasCorrect(right);
    if (right) { setCorrect((c) => c + 1); }
  };
  const next = () => {
    const ni = idx + 1;
    if (ni >= cards.length) { finish(correctRef.current); return; }
    setIdx(ni); setSel(null); setChecked(false);
  };

  return (
    <div className="lesson-wrap">
      <div className="lesson-top">
        <button className="btn btn-ghost btn-sm icon-btn" onClick={() => finish(correctRef.current)} title={t("back")}><Icon name="logout" size={16} /></button>
        <div className={`pbar ${left <= 15 ? "danger" : ""}`}><span style={{ width: `${timePct}%`, background: left <= 15 ? "var(--flame)" : undefined }} /></div>
        <span className="hud-chip" style={{ fontSize: ".95rem" }}>⏱️ {left}s</span>
      </div>
      <div className="small muted center">{t("eventScore")}: {correct} · ⚡ {def.title}</div>
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
          : <button className="btn btn-accent btn-block" onClick={next}>{t("nextQ")}</button>}
      </div>
    </div>
  );
}
