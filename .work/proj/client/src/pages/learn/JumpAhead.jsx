/* JumpAhead.jsx — Duolingo-style «پرش از واحد»: a short quiz drawn from the
   unit's remaining free stages. Pass the bar (admin knob) → the whole unit
   unlocks and the skipped stages are marked done. Server-graded. */
import { useEffect, useState, useRef } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";
import Confetti from "../../components/Confetti.jsx";
import { TYPE_MAP } from "./QuestionTypes.jsx";
import { playCorrect, playWrong } from "../../lib/feedback.js";

export default function JumpAhead({ topic, onClose, onDone, onProfile }) {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const [quiz, setQuiz] = useState(null);
  const [err, setErr] = useState(null);
  const [phase, setPhase] = useState("intro"); // intro | run | result
  const [idx, setIdx] = useState(0);
  const [sel, setSel] = useState(null);
  const [checked, setChecked] = useState(false);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const answersRef = useRef([]);
  const dlg = useRef(null);

  useEffect(() => {
    api.get(`/learn/jump/${topic.id}?lang=${lang}`).then(setQuiz).catch((e) => setErr(e.data?.error || e.message));
  }, [topic.id, lang]);
  useEffect(() => { const onKey = (e) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [onClose]);

  const card = quiz?.cards?.[idx];
  const Type = card ? (TYPE_MAP[card.type] || TYPE_MAP.mcq) : null;
  const N = (n) => Number(n ?? 0).toLocaleString(fa ? "fa-IR" : "en-US");

  const check = () => {
    if (!card || sel == null) return;
    const right = Type.judge(card, { sel });
    answersRef.current.push({ cardId: card.id, sel });
    setChecked(true);
    if (right) playCorrect(); else playWrong();
  };
  const next = async () => {
    if (idx + 1 < quiz.cards.length) { setIdx(idx + 1); setSel(null); setChecked(false); return; }
    setBusy(true);
    try {
      const r = await api.post(`/learn/jump/${topic.id}`, { answers: answersRef.current });
      setResult(r); setPhase("result"); if (r.profile) onProfile?.(r.profile);
      if (r.passed) onDone?.();
    } catch (e) { setErr(e.data?.error || e.message); } finally { setBusy(false); }
  };

  const body = () => {
    if (err) return <div className="empty-state"><div className="ico">🙈</div><div className="muted">{err === "nothing to skip" ? (fa ? "چیزی برای پرش نمانده — همین حالا نزدیک پایان این واحدی!" : "Nothing left to skip — you're almost done with this unit!") : err === "already unlocked" ? (fa ? "این واحد قبلاً باز شده است." : "This unit is already unlocked.") : err}</div></div>;
    if (!quiz) return <div className="skeleton" style={{ height: 160 }} />;
    if (phase === "intro") {
      return (
        <div className="ja-intro">
          <div className="ja-emoji">🚀</div>
          <h3>{fa ? `پرش از «${quiz.topic}»` : `Jump ahead in “${quiz.topic}”`}</h3>
          <p className="muted">
            {fa
              ? `${N(quiz.cards.length)} سؤال از ${N(quiz.skipping)} مرحلهٔ باقی‌ماندهٔ این واحد. اگر حداقل ${N(quiz.pass)}٪ درست بزنی، همهٔ این مرحله‌ها باز و «انجام‌شده» می‌شوند. اشتباه‌ها قلب کم نمی‌کنند.`
              : `${quiz.cards.length} questions sampled from the ${quiz.skipping} remaining stages. Score at least ${quiz.pass}% and the whole unit unlocks. Mistakes don't cost hearts.`}
          </p>
          <div className="ja-actions">
            <button className="btn btn-accent btn-lg" onClick={() => setPhase("run")}><Icon name="play" size={16} /> {fa ? "شروع آزمون پرش" : "Start"}</button>
            <button className="btn btn-ghost" onClick={onClose}>{fa ? "بی‌خیال" : "Not now"}</button>
          </div>
        </div>
      );
    }
    if (phase === "run" && card) {
      const right = checked && Type.judge(card, { sel });
      return (
        <div className="ja-run">
          <div className="lesson-top" style={{ marginBottom: 8 }}>
            <div className="pbar"><span style={{ width: `${Math.round(((idx + (checked ? 1 : 0)) / quiz.cards.length) * 100)}%` }} /></div>
            <span className="tag">{N(idx + 1)}/{N(quiz.cards.length)}</span>
          </div>
          <div className="lesson-q">{card.q}</div>
          <Type card={card} checked={checked} sel={sel} setSel={setSel} isCorrect={right} />
          {checked && <div className={`lesson-fb ${right ? "ok" : "bad"}`} style={{ marginTop: 10 }}><b>{right ? t("correct") : t("wrong")}</b></div>}
          <div className="lesson-cta" style={{ marginTop: 12 }}>
            {!checked
              ? <button className="btn btn-primary btn-block" disabled={sel == null} onClick={check}>{t("check") || (fa ? "بررسی پاسخ" : "Check")}</button>
              : <button className="btn btn-accent btn-block" disabled={busy} onClick={next}>{idx + 1 < quiz.cards.length ? (t("next") || (fa ? "بعدی" : "Next")) : (fa ? "پایان و نتیجه" : "Finish")}</button>}
          </div>
        </div>
      );
    }
    if (phase === "result" && result) {
      return (
        <div className="ja-intro">
          {result.passed && <Confetti duration={3000} pieces={160} />}
          <div className="ja-emoji">{result.passed ? "🏆" : "📚"}</div>
          <h3>{result.passed ? (fa ? "پرش موفق!" : "You jumped ahead!") : (fa ? "این بار نشد" : "Not this time")}</h3>
          <div className="prob-ring" style={{ margin: "8px auto", "--p": result.pct, "--c": result.passed ? "var(--accent2)" : "var(--danger)" }}>
            <div className="prob-inner"><b style={{ fontSize: "1.5rem" }}>{N(result.pct)}٪</b><div className="small muted">{N(result.correct)}/{N(result.total)}</div></div>
          </div>
          <p className="muted small">
            {result.passed
              ? (fa ? `${N(result.skipped)} مرحله باز و انجام‌شده علامت خورد. هر وقت خواستی می‌توانی برگردی و آن‌ها را برای ستارهٔ کامل تمرین کنی.` : `${result.skipped} stages unlocked and marked done. You can always come back and practise them for full stars.`)
              : (fa ? `برای پرش حداقل ${N(result.pass)}٪ لازم بود. مسیر عادی همین‌جا ادامه دارد — و بعد از چند درس دوباره می‌توانی امتحان کنی.` : `You needed ${result.pass}% to jump. Keep going on the normal path and try again after a few lessons.`)}
          </p>
          <button className="btn btn-primary" onClick={onClose}>{fa ? "بازگشت به مسیر" : "Back to path"}</button>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="modal-back ja-backdrop" onClick={(e) => { if (e.target === e.currentTarget && phase !== "run") onClose(); }}>
      <div className="modal ja-modal" role="dialog" aria-modal="true" aria-label={fa ? "پرش از واحد" : "Jump ahead"} ref={dlg}>
        <button type="button" className="btn btn-ghost btn-sm icon-btn ja-close" onClick={onClose} aria-label={t("close") || "close"}><Icon name="close" size={16} /></button>
        {body()}
      </div>
    </div>
  );
}
