import { useEffect, useState, useRef } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";
import Confetti from "../../components/Confetti.jsx";
import { TYPE_MAP } from "./QuestionTypes.jsx";
import { HeartIcon, GemIcon } from "../../components/StatIcons.jsx";
import { playFanfare, playComplete } from "../../lib/feedback.js";

/* Legendary challenge (crown 6): a harder, high-accuracy run of a MASTERED
   lesson. Costs gems (free for premium). Passing (≥ pass ratio) turns the node
   legendary — a purple/gold crown — and grants bonus XP. Duolingo-style. */
export default function Legendary({ nodeId, onProfile, onDone }) {
  const { t, lang } = useApp();
  const [status, setStatus] = useState(null);   // eligibility + cost
  const [phase, setPhase] = useState("intro");   // intro | play | done
  const [cards, setCards] = useState([]);
  const [idx, setIdx] = useState(0);
  const [sel, setSel] = useState(null);
  const [checked, setChecked] = useState(false);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const correctRef = useRef(0);
  const MAX_MISTAKES = 3;   // Duolingo legendary allows up to 3 mistakes

  useEffect(() => { api.get(`/learn/legendary/${nodeId}?lang=${lang}`).then(setStatus).catch(() => setStatus({ enabled: false })); }, [nodeId, lang]);

  const start = async () => {
    setBusy(true);
    try {
      const r = await api.post(`/learn/legendary/${nodeId}/start`, {});
      setCards(r.cards || []); setIdx(0); setSel(null); setChecked(false); setCorrect(0); setMistakes(0);
      correctRef.current = 0; setResult(null); setPhase("play");
    } catch (e) { alert(lang === "fa" ? "جم کافی نیست یا این درس واجد شرایط نیست" : "Not enough gems or not eligible"); }
    finally { setBusy(false); }
  };

  const finish = async (finalCorrect) => {
    try {
      const r = await api.post(`/learn/legendary/${nodeId}/finish`, { correct: finalCorrect, total: cards.length });
      if (r?.passed) playFanfare(); else playComplete();
      setResult(r); if (r.profile) onProfile?.(r.profile); setPhase("done");
    } catch { setPhase("done"); }
  };

  if (!status) return <div className="card"><div className="skeleton" style={{ height: 160 }} /></div>;
  if (!status.enabled) return (
    <div className="card empty-state"><div className="ico">👑</div><h3>{t("legendaryDisabled")}</h3>
      <button className="btn btn-ghost mt16" onClick={onDone}>{t("back")}</button></div>
  );

  if (phase === "intro") return (
    <div className="page">
      <div className="section-title"><h2>👑 {t("legendaryTitle")}</h2></div>
      <div className="card legendary-intro">
        <div className="legendary-crown">👑</div>
        {status.isLegendary
          ? <p>{t("legendaryAlready")}</p>
          : !status.mastered
            ? <p>{t("legendaryNeedMaster")}</p>
            : <>
                <p>{t("legendaryIntro").replace("{p}", status.passRatio)}</p>
                <ul className="ramp-rules small muted">
                  <li>🎯 {t("legendaryPass")}: {status.passRatio}%</li>
                  <li><HeartIcon size={14} /> {t("legendaryMistakes").replace("{m}", MAX_MISTAKES)}</li>
                  <li>➕ {t("legendaryXp")}: +{status.xpReward} XP</li>
                  <li>{status.premium ? <>👑 {t("legendaryFreePremium")}</> : <><GemIcon size={14} /> {t("legendaryCost")}: {status.cost}</>}</li>
                </ul>
                <button className="btn btn-primary btn-block" disabled={busy || (!status.premium && status.gems < status.cost)} onClick={start}>
                  <Icon name="play" size={16} /> {status.premium ? t("legendaryStartFree") : <>{t("legendaryStart")} · <GemIcon size={14} /> {status.cost}</>}
                </button>
              </>}
        <button className="btn btn-ghost btn-block mt8" onClick={onDone}>{t("back")}</button>
      </div>
    </div>
  );

  if (phase === "done" && result) {
    const passed = result.passed;
    return (
      <div className="lesson-wrap">
        {passed && <Confetti />}
        <div className="celebrate card">
          <div style={{ fontSize: 56 }}>{passed ? "👑" : "💫"}</div>
          <h2 style={{ border: "none" }}>{passed ? t("legendaryWon") : t("legendaryFailed")}</h2>
          {passed
            ? <><div className="big">+{result.xp} {t("xp")}</div>
                <div className="small muted">{t("legendaryCountNote").replace("{n}", result.legendaryCount)}</div></>
            : <div className="small muted">{t("legendaryTryAgain").replace("{r}", result.ratio).replace("{n}", result.needed)}</div>}
        </div>
        <button className="btn btn-primary btn-block mt16" onClick={onDone}><Icon name="check" size={16} /> {t("continueLearning")}</button>
      </div>
    );
  }

  // play phase
  if (!cards.length) return <div className="card empty-state"><h3>{t("back")}</h3></div>;
  const card = cards[idx];
  const Type = TYPE_MAP[card.type] || TYPE_MAP.mcq;
  const canCheck = Type.canCheck({ sel }, card);
  const progress = Math.round((idx / cards.length) * 100);

  const check = () => {
    const right = Type.judge(card, { sel });
    setChecked(true); setWasCorrect(right);
    if (right) { setCorrect((c) => { correctRef.current = c + 1; return c + 1; }); }
    else setMistakes((m) => m + 1);
  };
  const next = () => {
    if (mistakes >= MAX_MISTAKES) { finish(correctRef.current); return; }   // too many mistakes → fail
    if (idx + 1 >= cards.length) { finish(correctRef.current); return; }
    setIdx(idx + 1); setSel(null); setChecked(false);
  };

  return (
    <div className="lesson-wrap legendary-run">
      <div className="lesson-top">
        <button className="btn btn-ghost btn-sm icon-btn" onClick={onDone} title={t("back")}><Icon name="logout" size={16} /></button>
        <div className="pbar"><span style={{ width: `${progress}%`, background: "linear-gradient(90deg,#a855f7,#eab308)" }} /></div>
        <span className="hud-chip" style={{ fontSize: ".95rem" }}>👑 {correct}/{cards.length}</span>
      </div>
      <div className="small muted center">
        {Array.from({ length: Math.max(0, MAX_MISTAKES - mistakes) }).map((_, i) => <HeartIcon key={"h" + i} size={14} />)}
        {"🖤".repeat(mistakes)} · {t("legendaryTitle")}
      </div>
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
          : <button className="btn btn-accent btn-block" onClick={next}>{idx + 1 < cards.length && mistakes < MAX_MISTAKES ? t("nextQ") : t("lessonComplete")}</button>}
      </div>
    </div>
  );
}
