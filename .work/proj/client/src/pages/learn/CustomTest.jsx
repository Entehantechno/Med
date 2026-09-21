import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";
import { TYPE_MAP, MicroLesson } from "./QuestionTypes.jsx";
import { PeerPercentile, OptionStatsBars } from "../../components/PeerBits.jsx";
import LabValuesModal from "../../components/LabValuesModal.jsx";

/* ================================================================
   آزمون‌ساز شخصی (premium) — UWorld/AMBOSS-style "Create Test".

   One screen, three questions, in this order (research: progressive
   disclosure, live counts, one primary CTA):
     1. چه سؤال‌هایی؟  — subjects (chips) → optional chapters of the chosen
                         subject(s), + question status (new / wrong / marked / all)
     2. چند تا؟        — preset sizes + free number, capped by what's available
     3. چطور؟          — tutor (feedback per question) | timed (exam block)
   The sticky footer always shows «شروع: N سؤال» with the live available
   count, so an empty test can never be built. Advanced filters (exam type,
   year, style) sit behind «فیلترهای بیشتر».
   ================================================================ */

const STATUS = [
  { id: "unused", fa: "جدید", en: "Unused", ico: "✨" },
  { id: "incorrect", fa: "غلط‌های من", en: "Incorrect", ico: "🔁" },
  { id: "marked", fa: "نشان‌شده", en: "Marked", ico: "🚩" },
  { id: "all", fa: "همه", en: "All", ico: "📚" },
];

export default function CustomTest({ onProfile, onBack, resumeId = null, onPremium }) {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const [phase, setPhase] = useState(resumeId ? "loading" : "build");
  const [cfg, setCfg] = useState({ topic: [], pathChapter: [], status: "all", n: 20, mode: "tutor", secPerQ: 60, order: "random", examType: [], year: [], style: [] });
  const [opts, setOpts] = useState(null);
  const [gate, setGate] = useState(false);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [test, setTest] = useState(null);
  const [history, setHistory] = useState([]);
  const [err, setErr] = useState("");
  const reqRef = useRef(0);

  // live counts (debounced) whenever the scope changes
  useEffect(() => {
    if (phase !== "build") return;
    const my = ++reqRef.current;
    const h = setTimeout(() => {
      api.post(`/learn/custom-test/options?lang=${lang}`, cfg)
        .then((d) => { if (my === reqRef.current) setOpts(d); })
        .catch((e) => { if (/402|premium/i.test(e.message)) setGate(true); else setErr(e.message); });
    }, opts ? 200 : 0);
    return () => clearTimeout(h);
  }, [cfg.topic, cfg.pathChapter, cfg.status, cfg.examType, cfg.year, cfg.style, phase, lang]); // eslint-disable-line

  useEffect(() => { api.get("/learn/custom-test/history").then((d) => setHistory(d.history || [])).catch(() => {}); }, [phase]);
  useEffect(() => {
    if (!resumeId) return;
    api.get(`/learn/custom-test/${resumeId}?lang=${lang}`).then((d) => { setTest(d); setPhase(d.status === "finished" ? "result" : "run"); }).catch((e) => { setErr(e.message); setPhase("build"); });
  }, [resumeId, lang]);

  const available = opts?.available ?? 0;
  const n = Math.min(cfg.n, Math.max(0, available));
  const toggle = (k, v) => setCfg((c) => {
    const list = c[k] || [];
    const next = list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
    // dropping a subject drops its chapters too
    const extra = k === "topic" && list.includes(v) ? { pathChapter: (c.pathChapter || []).filter((ch) => !(opts?.topics || []).find((tp) => tp.slug === v)?.chapters?.some((x) => x.value === ch)) } : {};
    return { ...c, [k]: next, ...extra };
  });

  const start = async () => {
    if (!n || busy) return;
    setBusy(true); setErr("");
    try {
      const d = await api.post(`/learn/custom-test/start?lang=${lang}`, { ...cfg, n });
      setTest(d); setPhase("run");
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  if (gate) return (
    <div className="page"><div className="card empty-state">
      <div className="ico" style={{ fontSize: 48 }}>👑</div>
      <h3>{fa ? "آزمون‌ساز ویژه اعضای پلاس است" : "The test builder is a Plus feature"}</h3>
      <div className="muted small mt8">{fa ? "با پلاس از کل بانک ۱۱٬۶۰۰ سؤالی، آزمون دلخواه خودت را بساز: مثلاً ۲۰ سؤال تصادفی گوارش یا ۳۰ سؤال دیابت." : "Plus lets you build any test from the 11,600-question bank."}</div>
      <button className="btn btn-primary mt16" onClick={() => window.dispatchEvent(new CustomEvent("medlab-go", { detail: "premium" }))}>{fa ? "مشاهده پلاس" : "See Plus"}</button>
      <button className="btn btn-ghost mt8" onClick={onBack}>{t("back")}</button>
    </div></div>
  );

  if (phase === "run" && test) return <Runner test={test} setTest={setTest} onFinish={(r) => { setTest((x) => ({ ...x, ...r, status: "finished" })); onProfile?.(r.profile); setPhase("result"); }} onQuit={() => { setPhase("build"); setTest(null); }} />;
  if (phase === "result" && test) return <Result test={test} onAgain={() => { setPhase("build"); setTest(null); }} onBack={onBack} onPremium={onPremium} />;
  if (phase === "loading") return <div className="page"><div className="card"><div className="skeleton" style={{ height: 200 }} /></div></div>;

  /* ---------------- BUILDER ---------------- */
  const chosenTopics = (opts?.topics || []).filter((tp) => cfg.topic.includes(tp.slug));
  const chapterPool = chosenTopics.flatMap((tp) => (tp.chapters || []).map((ch) => ({ ...ch, topic: tp })));
  const scopeLabel = cfg.pathChapter.length ? cfg.pathChapter.join("، ")
    : cfg.topic.length ? chosenTopics.map((x) => x.name).join("، ")
    : (fa ? "همهٔ درس‌ها" : "all subjects");

  return (
    <div className="page ct-page">
      <div className="section-title"><h2><Icon name="exam" size={22} /> {fa ? "آزمون‌ساز" : "Create test"} <span className="ct-crown">👑</span></h2></div>
      <div className="muted small mb16">{fa ? "خودت انتخاب کن: کدام مبحث، چند سؤال، به چه شکل. مثلاً «۲۰ سؤال تصادفی گوارش» یا «۳۰ سؤال دیابت»." : "You choose: which topics, how many, and how. e.g. “20 random GI questions”."}</div>

      {/* 1) WHAT */}
      <section className="card ct-step">
        <div className="ct-step-head"><span className="ct-num">۱</span><b>{fa ? "چه سؤال‌هایی؟" : "Which questions?"}</b>
          {cfg.topic.length > 0 && <button className="ct-clear" onClick={() => setCfg((c) => ({ ...c, topic: [], pathChapter: [] }))}>{fa ? "همهٔ درس‌ها" : "All subjects"}</button>}
        </div>
        <div className="ct-chips">
          {(opts?.topics || []).map((tp) => (
            <button key={tp.slug} type="button" className={`ct-chip ${cfg.topic.includes(tp.slug) ? "on" : ""}`} style={{ "--c": tp.color }} onClick={() => toggle("topic", tp.slug)} aria-pressed={cfg.topic.includes(tp.slug)}>
              <span className="ct-chip-emoji">{tp.emoji}</span>{tp.name}<span className="ct-count">{tp.count}</span>
            </button>
          ))}
          {!opts && <span className="skeleton" style={{ height: 34, width: "100%" }} />}
        </div>

        {chapterPool.length > 0 && (
          <div className="ct-sub">
            <div className="ct-sub-title">{fa ? "فقط این فصل‌ها (اختیاری):" : "Only these chapters (optional):"}
              {cfg.pathChapter.length > 0 && <button className="ct-clear" onClick={() => setCfg((c) => ({ ...c, pathChapter: [] }))}>{fa ? "همهٔ فصل‌ها" : "All chapters"}</button>}
            </div>
            <div className="ct-chips ct-chips-sm">
              {chapterPool.map((ch) => (
                <button key={ch.topic.slug + ch.value} type="button" className={`ct-chip sm ${cfg.pathChapter.includes(ch.value) ? "on" : ""}`} style={{ "--c": ch.topic.color }} onClick={() => toggle("pathChapter", ch.value)} aria-pressed={cfg.pathChapter.includes(ch.value)}>
                  {chosenTopics.length > 1 && <span className="ct-chip-emoji">{ch.topic.emoji}</span>}{ch.label}<span className="ct-count">{ch.count}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="ct-sub">
          <div className="ct-sub-title">{fa ? "وضعیت سؤال‌ها:" : "Question status:"}</div>
          <div className="ct-seg" role="radiogroup">
            {STATUS.map((s) => {
              const c = opts?.statusCounts?.[s.id] ?? 0;
              return (
                <button key={s.id} type="button" role="radio" aria-checked={cfg.status === s.id} className={`ct-seg-btn ${cfg.status === s.id ? "on" : ""}`} disabled={!c && cfg.status !== s.id} onClick={() => setCfg((x) => ({ ...x, status: s.id }))}>
                  <span>{s.ico} {fa ? s.fa : s.en}</span><span className="ct-count">{c}</span>
                </button>
              );
            })}
          </div>
        </div>

        <button type="button" className="ct-more" onClick={() => setMore((m) => !m)} aria-expanded={more}>
          <Icon name={more ? "chevronUp" : "chevronDown"} size={14} /> {fa ? "فیلترهای بیشتر" : "More filters"}
          {(cfg.examType.length + cfg.year.length + cfg.style.length) > 0 && <span className="ct-badge">{cfg.examType.length + cfg.year.length + cfg.style.length}</span>}
        </button>
        {more && opts && (
          <div className="ct-adv">
            {[["examType", fa ? "نوع آزمون" : "Exam type"], ["year", fa ? "سال آزمون" : "Exam year"], ["style", fa ? "سبک سؤال" : "Question style"]].map(([k, label]) => (
              (opts.facets?.[k] || []).length > 1 && (
                <div key={k} className="ct-sub">
                  <div className="ct-sub-title">{label}:</div>
                  <div className="ct-chips ct-chips-sm">
                    {(opts.facets[k] || []).slice(0, 24).map((o) => (
                      <button key={o.value} type="button" className={`ct-chip sm ${cfg[k].includes(String(o.value)) ? "on" : ""}`} onClick={() => toggle(k, String(o.value))} aria-pressed={cfg[k].includes(String(o.value))}>{o.label}<span className="ct-count">{o.count}</span></button>
                    ))}
                  </div>
                </div>
              )
            ))}
          </div>
        )}
      </section>

      {/* 2) HOW MANY */}
      <section className="card ct-step">
        <div className="ct-step-head"><span className="ct-num">۲</span><b>{fa ? "چند سؤال؟" : "How many?"}</b><span className="muted small">{fa ? `${available} سؤال در دسترس` : `${available} available`}</span></div>
        <div className="ct-sizes">
          {(opts?.presets || [10, 20, 30, 40, 60]).map((k) => (
            <button key={k} type="button" className={`ct-size ${cfg.n === k ? "on" : ""}`} disabled={available < 1} onClick={() => setCfg((c) => ({ ...c, n: k }))}>{k}</button>
          ))}
          <label className="ct-size-custom">
            <input type="number" min={1} max={Math.min(opts?.maxN || 100, Math.max(1, available))} value={cfg.n} onChange={(e) => setCfg((c) => ({ ...c, n: Math.max(1, Math.min(opts?.maxN || 100, parseInt(e.target.value, 10) || 1)) }))} aria-label={fa ? "تعداد دلخواه" : "Custom count"} />
          </label>
        </div>
        {available > 0 && cfg.n > available && <div className="small muted mt8">{fa ? `فقط ${available} سؤال با این فیلترها هست؛ آزمون ${available} سؤالی ساخته می‌شود.` : `Only ${available} match; the test will have ${available}.`}</div>}
        <div className="ct-order">
          <span className="small muted">{fa ? "ترتیب:" : "Order:"}</span>
          {[["random", fa ? "تصادفی" : "Random"], ["newest", fa ? "جدیدترین آزمون‌ها" : "Newest exams"], ["oldest", fa ? "قدیمی‌ترین" : "Oldest"]].map(([k, l]) => (
            <button key={k} type="button" className={`ct-pill ${cfg.order === k ? "on" : ""}`} onClick={() => setCfg((c) => ({ ...c, order: k }))}>{l}</button>
          ))}
        </div>
      </section>

      {/* 3) HOW */}
      <section className="card ct-step">
        <div className="ct-step-head"><span className="ct-num">۳</span><b>{fa ? "به چه شکل؟" : "How?"}</b></div>
        <div className="ct-modes">
          <button type="button" className={`ct-mode ${cfg.mode === "tutor" ? "on" : ""}`} onClick={() => setCfg((c) => ({ ...c, mode: "tutor" }))} aria-pressed={cfg.mode === "tutor"}>
            <div className="ct-mode-ico">🎓</div>
            <div><b>{fa ? "آموزشی" : "Tutor"}</b><div className="small muted">{fa ? "بعد از هر سؤال، پاسخ و پاسخنامه را ببین. بدون زمان." : "Answer + explanation after each question. Untimed."}</div></div>
          </button>
          <button type="button" className={`ct-mode ${cfg.mode === "timed" ? "on" : ""}`} onClick={() => setCfg((c) => ({ ...c, mode: "timed" }))} aria-pressed={cfg.mode === "timed"}>
            <div className="ct-mode-ico">⏱️</div>
            <div><b>{fa ? "زمان‌دار (شبیه آزمون)" : "Timed (exam-like)"}</b><div className="small muted">{fa ? "پاسخ‌ها فقط در پایان. با تایمر." : "Feedback only at the end. With a timer."}</div></div>
          </button>
        </div>
        {cfg.mode === "timed" && (
          <div className="ct-order">
            <span className="small muted">{fa ? "زمان هر سؤال:" : "Per question:"}</span>
            {[45, 60, 90, 120].map((s) => <button key={s} type="button" className={`ct-pill ${cfg.secPerQ === s ? "on" : ""}`} onClick={() => setCfg((c) => ({ ...c, secPerQ: s }))}>{s}s</button>)}
            <span className="small muted">≈ {Math.round((n * cfg.secPerQ) / 60)} {fa ? "دقیقه" : "min"}</span>
          </div>
        )}
      </section>

      {err && <div className="card" style={{ borderInlineStart: "4px solid var(--danger)" }}>{err}</div>}

      {/* sticky CTA */}
      <div className="ct-cta">
        <div className="ct-cta-info">
          <b>{n} {fa ? "سؤال" : "questions"}</b>
          <span className="small muted">{scopeLabel} · {fa ? STATUS.find((s) => s.id === cfg.status)?.fa : cfg.status} · {cfg.mode === "timed" ? (fa ? "زمان‌دار" : "timed") : (fa ? "آموزشی" : "tutor")}</span>
        </div>
        <button className="btn btn-accent" disabled={!n || busy} onClick={start}><Icon name="play" size={16} /> {fa ? "شروع آزمون" : "Start"}</button>
      </div>

      {history.length > 0 && (
        <div className="card mt16">
          <div style={{ fontWeight: 800, marginBottom: 8 }}>{fa ? "آزمون‌های قبلی" : "Previous tests"}</div>
          {history.map((h) => (
            <div key={h.id} className="ct-hist">
              <div>
                <div className="small"><b>{h.n}</b> {fa ? "سؤال" : "Q"} · {h.mode === "timed" ? "⏱️" : "🎓"} {(h.scope?.pathChapter?.length ? h.scope.pathChapter : h.scope?.topic || []).join("، ") || (fa ? "همهٔ درس‌ها" : "all")}</div>
                <div className="small muted">{(h.finishedAt || h.startedAt || "").slice(0, 10)}</div>
              </div>
              {h.status === "finished"
                ? <b style={{ color: h.accuracy >= 60 ? "var(--accent2)" : "var(--danger)" }}>{h.correct}/{h.total}</b>
                : <button className="btn btn-sm btn-primary" onClick={() => { setPhase("loading"); api.get(`/learn/custom-test/${h.id}?lang=${lang}`).then((d) => { setTest(d); setPhase("run"); }).catch(() => setPhase("build")); }}>{fa ? `ادامه (${h.answered}/${h.n})` : `Resume (${h.answered}/${h.n})`}</button>}
            </div>
          ))}
        </div>
      )}
      <button className="btn btn-ghost btn-block mt16" onClick={onBack}>{t("back")}</button>
    </div>
  );
}

function parseStartedAt(raw) {
  if (!raw) return Date.now();
  if (typeof raw === "number") return isNaN(raw) ? Date.now() : raw;
  const s = String(raw).trim();
  if (!s) return Date.now();
  if (/Z|[+-]\d{2}:?\d{2}$/i.test(s)) {
    const t = Date.parse(s);
    return isNaN(t) ? Date.now() : t;
  }
  const iso = s.replace(" ", "T") + "Z";
  const t = Date.parse(iso);
  return isNaN(t) ? (Date.parse(s) || Date.now()) : t;
}

/* ---------------- RUNNER ---------------- */
function Runner({ test, setTest, onFinish, onQuit }) {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const timed = test.config?.mode === "timed";
  const cards = test.cards || [];
  const answers = test.answers || {};
  const firstOpen = Math.max(0, cards.findIndex((c) => !answers[c.id]));
  const [idx, setIdx] = useState(firstOpen < 0 ? 0 : firstOpen);
  const [sel, setSel] = useState(null);
  const [checked, setChecked] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [flag, setFlag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showLabModal, setShowLabModal] = useState(false);
  const startedAt = useMemo(() => parseStartedAt(test.startedAt), [test.startedAt]);
  const [remaining, setRemaining] = useState(() => timed ? Math.max(0, test.durationS - Math.floor((Date.now() - startedAt) / 1000)) : 0);
  const qStart = useRef(Date.now());
  const card = cards[idx];
  const Type = card ? (TYPE_MAP[card.type] || TYPE_MAP.mcq) : null;
  const answered = Object.keys(answers).length;
  const canCheck = Type?.canCheck ? Type.canCheck({ sel }, card) : sel != null;

  useEffect(() => { qStart.current = Date.now(); setSel(null); setChecked(false); setFeedback(null); setFlag(!!answers[card?.id]?.flagged); }, [idx]); // eslint-disable-line
  useEffect(() => {
    if (!timed) return;
    const h = setInterval(() => setRemaining((s) => { if (s <= 1) { clearInterval(h); finish(true); return 0; } return s - 1; }), 1000);
    return () => clearInterval(h);
  }, [timed]); // eslint-disable-line

  const submit = async () => {
    if (!card || busy) return;
    const localCorrect = Type.judge(card, { sel });
    const responseMs = Date.now() - qStart.current;
    const localAnswers = { ...answers, [card.id]: { correct: localCorrect, sel, flagged: flag } };
    setTest((x) => ({ ...x, answers: localAnswers }));

    if (!timed) {
      setChecked(true);
      setFeedback({ correct: localCorrect, card });
    } else if (idx + 1 < cards.length) {
      setIdx(idx + 1);
    }

    setBusy(true);
    try {
      const r = await api.post(`/learn/custom-test/${test.id}/answer`, { cardId: card.id, sel, correct: localCorrect, responseMs, flagged: flag });
      const next = { ...answers, [card.id]: { correct: r.correct, sel, flagged: flag } };
      setTest((x) => ({ ...x, answers: next }));
      if (!timed && r.card) {
        setFeedback((prev) => ({ ...prev, card: r.card }));
      }
    } catch (e) {
      console.warn("Custom test answer sync:", e.message || e);
    } finally {
      setBusy(false);
    }
  };
  const finish = async (auto = false) => {
    if (busy && !auto) return;
    setBusy(true);
    try {
      const r = await api.post(`/learn/custom-test/${test.id}/finish`, { timeMs: Date.now() - startedAt });
      onFinish(r);
    } catch (e) {
      alert(e.message);
      setBusy(false);
    }
  };
  const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  if (!card) return null;
  const prev = answers[card.id];

  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "l" || e.key === "L" || e.code === "KeyL") {
        e.preventDefault();
        setShowLabModal((s) => !s);
        return;
      }
      if (showLabModal) return;
      if (e.key === "f" || e.key === "F" || e.code === "KeyF") {
        e.preventDefault();
        setFlag((prev) => !prev);
        return;
      }
      let num = -1;
      if (e.key >= "1" && e.key <= "9") num = Number(e.key) - 1;
      else if ("۱۲۳۴۵۶۷۸۹".includes(e.key)) num = "۱۲۳۴۵۶۷۸۹".indexOf(e.key);
      else if ("١٢٣٤٥٦٧٨٩".includes(e.key)) num = "١٢٣٤٥٦٧٨٩".indexOf(e.key);
      else if (e.code && /^Digit[1-9]$/.test(e.code)) num = Number(e.code.slice(5)) - 1;
      else if (e.code && /^Numpad[1-9]$/.test(e.code)) num = Number(e.code.slice(6)) - 1;

      if (num >= 0 && card?.options && num < card.options.length && !prev) {
        e.preventDefault();
        setSel(num);
        return;
      }
      if (e.key === "Enter") {
        if (!prev && !checked && canCheck && !busy) {
          e.preventDefault();
          submit();
        } else if ((prev || checked) && idx + 1 < cards.length) {
          e.preventDefault();
          setIdx(idx + 1);
        } else if ((prev || checked) && idx + 1 >= cards.length && !busy) {
          e.preventDefault();
          finish(false);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, sel, checked, prev, busy, idx, cards.length, showLabModal, canCheck]);

  return (
    <div className="lesson-wrap ct-run">
      <div className="lesson-top">
        <button className="btn btn-ghost btn-sm" onClick={onQuit} aria-label={t("back")}><Icon name="close" size={16} /></button>
        <div className="pbar"><span style={{ width: `${Math.round((answered / cards.length) * 100)}%` }} /></div>
        <button
          type="button"
          className="btn btn-ghost btn-sm icon-btn"
          onClick={() => setShowLabModal(true)}
          title={fa ? "مقادیر نرمال آزمایشگاهی" : "Normal Lab Values"}
          aria-label={fa ? "مقادیر نرمال آزمایشگاهی" : "Normal Lab Values"}
        >
          🧪
        </button>
        {timed ? <span className={`tag ${remaining < 60 ? "danger-tag" : ""}`} style={{ fontVariantNumeric: "tabular-nums" }}><Icon name="clock" size={13} /> {mmss(remaining)}</span> : <span className="tag">🎓</span>}
        <span className="tag">{idx + 1}/{cards.length}</span>
      </div>

      {/* question navigator (UWorld-style strip) */}
      <div className="ct-nav" role="tablist" aria-label={fa ? "سؤال‌ها" : "Questions"}>
        {cards.map((c, i) => {
          const a = answers[c.id];
          return <button key={c.id} role="tab" aria-selected={i === idx} className={`ct-nav-dot ${i === idx ? "cur" : ""} ${a ? (timed ? "done" : a.correct ? "ok" : "bad") : ""} ${a?.flagged ? "flag" : ""}`} onClick={() => setIdx(i)}>{i + 1}</button>;
        })}
      </div>

      <div className="card">
        {card.source && <div className="small muted mb8">{card.source}</div>}
        <div className="q-text">{card.q}</div>
        <Type card={card} sel={prev && !feedback ? prev.sel : sel} setSel={prev ? () => {} : setSel} checked={checked || (!timed && !!prev)} />
        {(feedback || (!timed && prev)) && (() => {
          const fc = feedback?.card || card; const ok = feedback ? feedback.correct : prev.correct;
          return (
            <div className={`ct-feedback ${ok ? "ok" : "bad"}`}>
              <b>{ok ? (fa ? "درست ✅" : "Correct ✅") : (fa ? "نادرست ❌" : "Incorrect ❌")}</b>
              {fc.optionStats && <OptionStatsBars card={fc} sel={feedback ? sel : prev?.sel} />}
              {fc.explain?.text && <div className="mt8 small">{fc.explain.text}</div>}
              {fc.attending && <div className="attending-tip mt8"><div className="at-text">{fc.attending}</div></div>}
              {fc.micro && <MicroLesson micro={fc.micro} defaultOpen={false} />}
            </div>
          );
        })()}
      </div>

      <div className="lesson-actions" style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button className={`btn btn-ghost btn-sm ${flag ? "ct-flag-on" : ""}`} onClick={() => setFlag((f) => !f)} aria-pressed={flag} title={fa ? "نشان‌کردن برای مرور" : "Mark for review"}>🚩</button>
        <button className="btn btn-ghost" disabled={idx === 0} onClick={() => setIdx(idx - 1)}><Icon name="chevronRight" size={15} /></button>
        {!prev && !checked
          ? <button className="btn btn-primary" style={{ flex: 1 }} disabled={!canCheck || busy} onClick={submit}>{timed ? (fa ? "ثبت و بعدی" : "Save & next") : t("check")}</button>
          : idx + 1 < cards.length
            ? <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setIdx(idx + 1)}>{t("nextQ")} <Icon name="chevronLeft" size={15} /></button>
            : <button className="btn btn-accent" style={{ flex: 1 }} disabled={busy} onClick={() => finish(false)}><Icon name="check" size={15} /> {busy ? (fa ? "در حال ثبت نهایی..." : "Finishing...") : (fa ? "پایان آزمون" : "Finish")}</button>}
        {answered < cards.length && (prev || checked) && idx + 1 >= cards.length && null}
      </div>
      {answered >= cards.length && idx + 1 < cards.length && (
        <button className="btn btn-accent btn-block mt8" disabled={busy} onClick={() => finish(false)}>{busy ? (fa ? "در حال ثبت نهایی..." : "Finishing...") : (fa ? "همه پاسخ داده شد — پایان آزمون" : "All answered — finish")}</button>
      )}
      <div className="muted small center mt8">{t("answered")}: {answered}/{cards.length}</div>
      <LabValuesModal isOpen={showLabModal} onClose={() => setShowLabModal(false)} lang={lang} />
    </div>
  );
}

/* ---------------- RESULT ---------------- */
function Result({ test, onAgain, onBack, onPremium }) {
  const { t, lang } = useApp();
  const fa = lang === "fa";
  const [open, setOpen] = useState(null);
  const total = test.total ?? (test.cards || []).length;
  const correct = test.correct ?? Object.values(test.answers || {}).filter((a) => a.correct).length;
  const pct = total ? Math.round((correct / total) * 100) : 0;
  const cards = test.cards || [];
  const answers = test.answers || {};
  return (
    <div className="page">
      <div className="card empty-state">
        <div className="ico" style={{ fontSize: "3rem" }}>{pct >= 60 ? "🎯" : "📚"}</div>
        <h2 style={{ margin: "6px 0" }}>{fa ? "نتیجهٔ آزمون" : "Test result"}</h2>
        <div className="prob-ring" style={{ margin: "12px auto", "--p": pct, "--c": pct >= 60 ? "var(--accent2)" : "var(--danger)" }}>
          <div className="prob-inner"><b style={{ fontSize: "1.7rem" }}>{pct}%</b><div className="small muted">{correct}/{total}</div></div>
        </div>
        {test.xp != null && <span className="tag">+{test.xp} XP</span>}
        <PeerPercentile peer={test.peer} onPremium={onPremium} />
        {Array.isArray(test.perTopic) && test.perTopic.length > 1 && (
          <div className="ct-pertopic">
            {test.perTopic.map((p) => <div key={p.topic} className="ct-pt-row"><span>{p.topic}</span><span className="ct-pt-bar"><span style={{ width: `${p.total ? Math.round((p.correct / p.total) * 100) : 0}%` }} /></span><b>{p.correct}/{p.total}</b></div>)}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button className="btn btn-primary" onClick={onAgain}>{fa ? "آزمون جدید" : "New test"}</button>
          <button className="btn btn-ghost" onClick={onBack}>{t("back")}</button>
        </div>
      </div>

      <div className="card mt16">
        <div style={{ fontWeight: 800, marginBottom: 8 }}>{fa ? "مرور سؤال‌ها" : "Review"}</div>
        {cards.map((c, i) => {
          const a = answers[c.id];
          const Type = TYPE_MAP[c.type] || TYPE_MAP.mcq;
          return (
            <div key={c.id} className={`ct-rev ${a ? (a.correct ? "ok" : "bad") : "skip"}`}>
              <button type="button" className="ct-rev-head" onClick={() => setOpen(open === c.id ? null : c.id)} aria-expanded={open === c.id}>
                <span className="ct-rev-n">{i + 1}</span>
                <span className="ct-rev-q">{c.q}</span>
                <span className="ct-rev-mark">{a ? (a.correct ? "✅" : "❌") : "—"}</span>
              </button>
              {open === c.id && (
                <div className="ct-rev-body">
                  <Type card={c} sel={a?.sel ?? null} setSel={() => {}} checked={true} />
                  {c.optionStats && <OptionStatsBars card={c} sel={a?.sel ?? null} />}
                  {c.explain?.text && <div className="answer-explain mt8"><div className="ae-text">{c.explain.text}</div></div>}
                  {c.micro && <MicroLesson micro={c.micro} defaultOpen={false} />}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
