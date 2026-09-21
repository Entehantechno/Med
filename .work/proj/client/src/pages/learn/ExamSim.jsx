import { useEffect, useState, useRef } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";
import { TYPE_MAP } from "./QuestionTypes.jsx";
import { PeerPercentile } from "../../components/PeerBits.jsx";

/* Exam SIMULATOR — a timed, exam-like block. No feedback until the end
   (just like a real exam), then a results screen with an estimated PASS
   PROBABILITY. The probability is computed server-side from pure statistics. */
export default function ExamSim({ onProfile, onBack, onPremium }) {
  const { t, lang } = useApp();
  const [topics, setTopics] = useState([]);
  const [chosen, setChosen] = useState([]);       // topic slugs (empty = all)
  const [count, setCount] = useState(20);
  const [phase, setPhase] = useState("setup");    // setup | running | result
  const [sim, setSim] = useState(null);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});     // idx -> {sel, correct}
  const [sel, setSel] = useState(null);
  const [remaining, setRemaining] = useState(0);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const startRef = useRef(0);
  const timerRef = useRef(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    // Use PATH topics: only subjects with actual questions are offered.
    api.get(`/learn/path?lang=${lang}`).then((d) => setTopics(
      (d.topics || []).filter((tp) => (tp.nodes || []).length > 0)
        .map((tp) => ({ slug: tp.slug, title: tp.name, emoji: tp.emoji }))
    )).catch(() => {});
    api.get("/learn/exam-sim/history").then((d) => setHistory(d.history || [])).catch(() => {});
  }, [lang]);

  // countdown timer
  useEffect(() => {
    if (phase !== "running") return;
    timerRef.current = setInterval(() => {
      setRemaining((s) => {
        if (s <= 1) { clearInterval(timerRef.current); finishExam(true); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  const toggleTopic = (slug) => setChosen((c) => c.includes(slug) ? c.filter((x) => x !== slug) : [...c, slug]);

  const start = async () => {
    setBusy(true);
    try {
      const d = await api.post("/learn/exam-sim/start", { topics: chosen, n: count, durationS: count * 60, lang });
      setSim(d); setPhase("running"); setIdx(0); setAnswers({}); setSel(null);
      setRemaining(d.durationS); startRef.current = Date.now();
    } catch (e) { alert(e.message); } finally { setBusy(false); }
  };

  const recordCurrent = () => {
    const card = sim.cards[idx];
    const Type = TYPE_MAP[card.type] || TYPE_MAP.mcq;
    const correct = Type.judge(card, { sel });
    setAnswers((a) => ({ ...a, [idx]: { correct } }));
    return correct;
  };

  const go = (dir) => {
    recordCurrent();
    const ni = idx + dir;
    if (ni >= 0 && ni < sim.cards.length) { setIdx(ni); setSel(null); }
  };

  const finishExam = async (auto = false) => {
    if (busy) return;
    clearInterval(timerRef.current);
    setBusy(true);
    // fold in the current (unsaved) selection
    let acc = { ...answers };
    if (!auto && sim.cards[idx] && acc[idx] === undefined) {
      const card = sim.cards[idx];
      const Type = TYPE_MAP[card.type] || TYPE_MAP.mcq;
      acc[idx] = { correct: Type.judge(card, { sel }) };
    }
    const correct = Object.values(acc).filter((x) => x.correct).length;
    const total = sim.cards.length;
    const timeMs = Date.now() - startRef.current;
    try {
      const r = await api.post(`/learn/exam-sim/${sim.id}/finish`, { correct, total, timeMs });
      setResult({ ...r, correct, total });
      onProfile?.(r.profile);
      setPhase("result");
      api.get("/learn/exam-sim/history").then((d) => setHistory(d.history || [])).catch(() => {});
    } catch (e) { alert(e.message); } finally { setBusy(false); }
  };

  const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  /* ---------- SETUP ---------- */
  if (phase === "setup") {
    return (
      <div className="page">
        <div className="section-title"><h2><Icon name="exam" size={22} /> {t("examSim")}</h2></div>
        <div className="muted small mb16">{t("examSimHint")}</div>

        <div className="card mb16">
          <div style={{ fontWeight: 800, marginBottom: 8 }}>{t("examSimTopics")}</div>
          <div className="muted small mb8">{t("examSimTopicsHint")}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {topics.map((tp) => (
              <button key={tp.slug} className={`btn btn-sm ${chosen.includes(tp.slug) ? "btn-primary" : "btn-ghost"}`}
                onClick={() => toggleTopic(tp.slug)}>
                <span style={{ fontSize: "1.1rem" }}>{tp.emoji}</span> {tp.title}
              </button>
            ))}
          </div>
        </div>

        <div className="card mb16">
          <div style={{ fontWeight: 800, marginBottom: 8 }}>{t("examSimCount")}</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[10, 20, 30, 40].map((n) => (
              <button key={n} className={`btn btn-sm ${count === n ? "btn-primary" : "btn-ghost"}`} onClick={() => setCount(n)}>{n}</button>
            ))}
          </div>
          <div className="muted small mt8">⏱️ {t("examSimTime")}: {count} {t("minutesShort")}</div>
        </div>

        <button className="btn btn-accent btn-block" disabled={busy} onClick={start}>
          <Icon name="play" size={16} /> {t("examSimStart")}
        </button>

        {history.length > 0 && (
          <div className="card mt16">
            <div style={{ fontWeight: 800, marginBottom: 8 }}>{t("examSimHistory")}</div>
            {history.map((h) => (
              <div key={h.id} className="lc-row" style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px dashed var(--line)" }}>
                <span className="small">{h.finishedAt?.slice(0, 10)} · {h.scope === "all" ? t("allTopics") : h.scope}</span>
                <span className="small">{h.correct}/{h.total} · <b style={{ color: h.passProb >= 50 ? "var(--accent2)" : "var(--danger)" }}>{h.passProb}%</b></span>
              </div>
            ))}
          </div>
        )}
        <button className="btn btn-ghost btn-block mt16" onClick={onBack}>{t("back")}</button>
      </div>
    );
  }

  /* ---------- RESULT ---------- */
  if (phase === "result" && result) {
    const b = result.breakdown || {};
    const pass = result.prob >= 50;
    return (
      <div className="page">
        <div className="card empty-state">
          <div className="ico" style={{ fontSize: "3rem" }}>{pass ? "🎯" : "📚"}</div>
          <h2 style={{ margin: "6px 0" }}>{t("examSimResult")}</h2>
          <div className="prob-ring" style={{ margin: "12px auto", "--p": result.prob, "--c": pass ? "var(--accent2)" : "var(--danger)" }}>
            <div className="prob-inner"><b style={{ fontSize: "1.7rem" }}>{result.prob}%</b><div className="small muted">{t("passProbability")}</div></div>
          </div>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>{result.correct}/{result.total} · {Math.round((result.correct / result.total) * 100)}%</div>
          <div className="case-meta" style={{ justifyContent: "center", flexWrap: "wrap" }}>
            <span className="tag">{t("simAccuracy")}: {b.simAccuracy}%</span>
            <span className="tag">{t("trackAccuracy")}: {b.trackAccuracy}%</span>
            <span className="tag">{t("passMark")}: {b.passMark}%</span>
            <span className="tag">+{result.xp} XP</span>
          </div>
          <PeerPercentile peer={result.peer} onPremium={onPremium} />
          <div className="muted small mt16" style={{ maxWidth: 460 }}>{t("passProbabilityNote")}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button className="btn btn-primary" onClick={() => { setPhase("setup"); setResult(null); }}>{t("examSimAgain")}</button>
            <button className="btn btn-ghost" onClick={onBack}>{t("back")}</button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- RUNNING ---------- */
  const card = sim.cards[idx];
  const Type = TYPE_MAP[card.type] || TYPE_MAP.mcq;
  const answeredCount = Object.keys(answers).length;
  return (
    <div className="lesson-wrap">
      <div className="lesson-top">
        <span className={`tag ${remaining < 60 ? "danger-tag" : ""}`} style={{ fontVariantNumeric: "tabular-nums" }}>
          <Icon name="clock" size={13} /> {mmss(remaining)}
        </span>
        <div className="pbar"><span style={{ width: `${Math.round(((idx + 1) / sim.cards.length) * 100)}%` }} /></div>
        <span className="tag">{idx + 1}/{sim.cards.length}</span>
      </div>

      <div className="card">
        <div className="q-text">{card.q}</div>
        {/* exam mode: NO feedback, NO درسنامه — just record the answer */}
        <Type card={card} sel={sel} setSel={setSel} checked={false} />
      </div>

      <div className="lesson-actions" style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-ghost" disabled={idx === 0} onClick={() => go(-1)}><Icon name="chevronRight" size={15} /> {t("prev")}</button>
        {idx + 1 < sim.cards.length
          ? <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => go(1)}>{t("nextQ")} <Icon name="chevronLeft" size={15} /></button>
          : <button className="btn btn-accent" style={{ flex: 1 }} disabled={busy} onClick={() => finishExam(false)}><Icon name="check" size={15} /> {t("examSimSubmit")}</button>}
      </div>
      <div className="muted small center mt8">{t("answered")}: {answeredCount}/{sim.cards.length}</div>
    </div>
  );
}
