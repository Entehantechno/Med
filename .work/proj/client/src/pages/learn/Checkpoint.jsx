import { useEffect, useState, useRef } from "react";
import { markBusy } from "../../lib/sw-update.js";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";
import Confetti from "../../components/Confetti.jsx";
import StatNum from "../../components/StatNum.jsx";
import { TYPE_MAP } from "./QuestionTypes.jsx";
import { typeLabel } from "./Lesson.jsx";
import { playCorrect, playWrong, playFanfare, playComplete } from "../../lib/feedback.js";
import LessonInsights from "../../components/LessonInsights.jsx";

/* ---------------------------------------------------------------------------
   Section Checkpoint exam (shelf-exam style, cumulative).
   A comprehensive test that MIXES questions from every completed lesson across
   a whole section (the topic parent group). It is intentionally NOT graded
   per-question with hearts: like a real subject/shelf exam you answer straight
   through and get a scaled score + pass/fail at the end. AI-free.
--------------------------------------------------------------------------- */
export default function Checkpoint({ onProfile }) {
  const { t, lang } = useApp();
  const [list, setList] = useState(null);
  const [err, setErr] = useState(null);
  const [exam, setExam] = useState(null);      // active exam { section, cards, ... }

  const load = () => {
    setErr(null); setList(null);
    api.get(`/learn/checkpoints?lang=${lang}`)
      .then(setList).catch((e) => setErr(e.message));
  };
  useEffect(() => { load(); }, [lang]);

  const start = (section) => {
    api.get(`/learn/checkpoint/${section}?lang=${lang}`)
      .then((d) => setExam(d))
      .catch((e) => setErr(e.message === "HTTP 429" ? t("cpCooldown") : e.message));
  };

  if (exam) return <ExamRunner exam={exam} onProfile={onProfile} onExit={() => { setExam(null); load(); }} />;

  if (err) return (
    <div className="card empty-state">
      <div className="ico"><Icon name="warn" size={40} /></div>
      <h3>{err === "feature disabled" ? t("cpDisabled") : err}</h3>
      <button className="btn btn-ghost mt16" onClick={load}>{t("retry")}</button>
    </div>
  );
  if (!list) return <div className="card"><div className="skeleton" style={{ height: 220 }} /></div>;

  if (!list.enabled) return (
    <div className="card empty-state"><div className="ico"><Icon name="exam" size={40} /></div><h3>{t("cpDisabled")}</h3></div>
  );

  const cps = list.checkpoints || [];
  return (
    <div className="cp-page">
      <div className="section-title">
        <h2><Icon name="exam" size={22} /> {t("cpTitle")}</h2>
      </div>
      <p className="muted cp-intro">{t("cpIntro")}</p>

      {cps.length === 0 && (
        <div className="card empty-state"><div className="ico"><Icon name="book" size={40} /></div><h3>{t("cpNoSections")}</h3></div>
      )}

      <div className="cp-grid">
        {cps.map((c) => (
          <div key={c.section} className={`card cp-card ${c.unlocked ? "" : "locked"} ${c.everPassed ? "passed" : ""}`}>
            <div className="cp-head">
              <span className="cp-emoji" aria-hidden="true">{c.emoji}</span>
              <div className="cp-head-txt">
                <h3>{c.label}</h3>
                <div className="small muted">{c.questionCount} {t("cpQuestions")} · {t("cpPass")} {c.passRatio}٪</div>
              </div>
              {c.everPassed && <span className="cp-badge-pass" title={t("cpPassed")}>✓ {t("cpPassed")}</span>}
            </div>

            <div className="cp-progress">
              <div className="cp-bar"><span style={{ width: `${c.progress}%` }} /></div>
              <div className="small muted">{t("cpDoneNodes").replace("{d}", c.doneNodes).replace("{n}", c.totalNodes)} ({c.progress}٪)</div>
            </div>

            {c.bestScore > 0 && (
              <div className="cp-best small">{t("cpBest")}: <b>{c.bestScore}٪</b>{c.attempts > 1 ? ` · ${t("cpAttempts").replace("{n}", c.attempts)}` : ""}</div>
            )}

            {c.unlocked ? (
              c.cooldownMin > 0
                ? <button className="btn btn-ghost btn-block" disabled>{t("cpCooldownMin").replace("{n}", c.cooldownMin)}</button>
                : <button className="btn btn-primary btn-block cp-start" onClick={() => start(c.section)}>
                    <Icon name="play" size={16} /> {c.attempts > 0 ? t("cpRetake") : t("cpStart")}
                  </button>
            ) : (
              <div className="cp-locked-note small">
                <Icon name="lock" size={14} /> {t("cpLockedNote").replace("{r}", c.requiredRatio).replace("{m}", c.requiredNodes)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------- exam runner (one question at a time) ------------------------- */
function ExamRunner({ exam, onProfile, onExit }) {
  // Tell sw-update.js that in-progress work is on screen: a new build must
  // not auto-reload the page until this screen unmounts.
  useEffect(() => { markBusy(true); return () => markBusy(false); }, []);
  const { t, lang } = useApp();
  const [idx, setIdx] = useState(0);
  const [sel, setSel] = useState(null);
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const startRef = useRef(Date.now());
  const cardStartRef = useRef(Date.now());
  const answersRef = useRef([]);
  // optional per-exam timer (budget = total questions * time_per_q).
  const totalSecs = exam.timePerQ ? exam.timePerQ * exam.cards.length : 0;
  const [left, setLeft] = useState(totalSecs);

  useEffect(() => {
    if (!totalSecs || result) return;
    const id = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [totalSecs, result]);

  // auto-submit when the clock runs out
  useEffect(() => { if (totalSecs && left === 0 && !result && !submitting) finish(); }, [left]);

  const cards = exam.cards;
  const card = cards[idx];
  const Type = card ? (TYPE_MAP[card.type] || TYPE_MAP.mcq) : TYPE_MAP.mcq;

  const check = () => {
    const right = Type.judge(card, { sel });
    setChecked(true);
    answersRef.current.push({ cardId: card.id, correct: right, responseMs: Date.now() - cardStartRef.current });
    if (right) { setCorrect((c) => c + 1); playCorrect(); } else { playWrong(); }
  };

  const finish = async () => {
    if (submitting) return;
    setSubmitting(true);
    // count any un-checked current card if the timer forced us here (treated wrong)
    try {
      const r = await api.post(`/learn/checkpoint/${exam.section}/finish`, {
        correct, total: cards.length,
        durationMs: Date.now() - startRef.current,
        answers: answersRef.current,
      });
      // Grand fanfare for passing a shelf-exam; a softer completion otherwise.
      if (r?.passed) playFanfare(); else playComplete();
      setResult(r); onProfile?.(r.profile);
    } catch (e) { setResult({ error: e.message }); }
  };

  const next = () => {
    if (idx + 1 < cards.length) {
      setIdx(idx + 1); setSel(null); setChecked(false); cardStartRef.current = Date.now();
    } else finish();
  };

  if (result) return <ExamResult result={result} onExit={onExit} />;

  const progress = Math.round((idx / cards.length) * 100);
  const canCheck = Type.canCheck({ sel }, card);
  const mm = Math.floor(left / 60), ss = String(left % 60).padStart(2, "0");
  const timeLow = totalSecs && left <= Math.max(15, Math.round(totalSecs * 0.1));

  return (
    <div className="lesson-wrap cp-exam">
      <div className="lesson-top">
        <button className="btn btn-ghost btn-sm icon-btn" onClick={onExit} title={t("cpExit")} aria-label={t("cpExit")}><Icon name="logout" size={16} /></button>
        <div className="pbar"><span style={{ width: `${progress}%` }} /></div>
        {totalSecs > 0 && (
          <span className={`cp-timer ${timeLow ? "low" : ""}`} title={t("cpTimeLeft")} aria-live="off">⏱ {mm}:{ss}</span>
        )}
        <span className="hud-chip" style={{ fontSize: ".95rem" }}><Icon name="exam" size={14} /> {exam.emoji} {exam.label}</span>
      </div>

      <div className="small muted center" style={{ marginBottom: 6 }}>
        {idx + 1} {t("of")} {cards.length} · <span className="type-tag">{typeLabel(card.type, lang)}</span>
      </div>
      <div className="lesson-q">{card.q}</div>
      {card.image && <img src={card.image} alt="" className="ddle-img" style={{ maxHeight: 200, margin: "0 auto 16px", display: "block" }} />}

      <Type card={card} checked={checked} sel={sel} setSel={setSel} isCorrect={checked && Type.judge(card, { sel })} />

      {/* Shelf-exam style: no correct/incorrect reveal mid-exam — just move on.
          Feedback + a full review come at the end so the exam mirrors the real
          test-taking experience (and keeps every question a genuine retrieval). */}
      <div className="lesson-actions">
        {!checked
          ? <button className="btn btn-primary btn-block" disabled={!canCheck} onClick={check}><Icon name="check" size={16} /> {t("cpConfirm")}</button>
          : <button className="btn btn-primary btn-block" onClick={next}>{idx + 1 < cards.length ? t("continue") : t("cpFinish")}</button>}
      </div>
    </div>
  );
}

/* ------------------------- result / score report ------------------------- */
function ExamResult({ result, onExit }) {
  const { t } = useApp();
  if (result.error) return (
    <div className="card empty-state"><div className="ico"><Icon name="warn" size={40} /></div><h3>{result.error}</h3>
      <button className="btn btn-ghost mt16" onClick={onExit}>{t("back")}</button></div>
  );
  const passed = result.passed;
  return (
    <div className="lesson-wrap cp-result">
      {passed && <Confetti />}
      <div className={`cp-result-card card ${passed ? "pass" : "fail"}`}>
        <div className="cp-result-emoji" aria-hidden="true">{passed ? "🎓" : "📚"}</div>
        <h2>{passed ? t("cpResultPass") : t("cpResultFail")}</h2>
        <div className="cp-score-big"><StatNum value={result.score} duration={1200} /><span className="pct">٪</span></div>
        <div className="muted">{t("cpScoreDetail").replace("{c}", result.correct).replace("{n}", result.total)} · {t("cpPass")} {result.passPct}٪</div>

        <div className="cp-result-stats">
          <div className="cp-stat"><span className="cp-stat-v">+<StatNum value={result.xp} duration={1100} delay={300} /></span><span className="cp-stat-l">XP</span></div>
          <div className="cp-stat"><span className="cp-stat-v">{result.bestScore}٪</span><span className="cp-stat-l">{t("cpBest")}</span></div>
        </div>

        {!passed && <p className="muted cp-encourage">{t("cpFailHint")}</p>}
        {passed && <p className="muted cp-encourage">{t("cpPassHint")}</p>}

        <button className="btn btn-primary btn-block mt16" onClick={onExit}>{t("cpBackToList")}</button>
      </div>
      <LessonInsights report={result.errorReport} srsAdded={result.srsAdded} newMastery={result.newMastery} />
    </div>
  );
}
