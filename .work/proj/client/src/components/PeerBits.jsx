/* PeerBits.jsx — Round 9 peer-benchmark widgets (UWorld/AMBOSS/مدوفست-informed).
     • OptionStatsBars   «شناسنامهٔ سؤال»: % of learners picking each option (free)
     • HintButton        pre-answer Attending hint (premium; gems for free users)
     • SaveFlashcardButton one-tap personal flashcard from a question (premium)
     • PeerPercentile    result percentile + time vs peers (premium)
     • DailyReportCard   today's performance card for the home (premium)
   All deterministic, all admin-switchable (game-config → peer). */
import { useEffect, useState } from "react";
import { useApp } from "../context.jsx";
import { api } from "../api.js";
import Icon from "./Icon.jsx";
import { optionLetter } from "../lib/optionLetter.js";

/* ---------- option pick percentages, shown AFTER answering ---------- */
export function OptionStatsBars({ card, sel, stats: statsProp }) {
  const { lang } = useApp();
  const fa = lang === "fa";
  const stats = statsProp ?? card?.optionStats;
  if (!stats || !Array.isArray(card?.options)) return null;
  if (!stats.ready) return null;   // too few answers yet — stay quiet rather than show noise
  const correctIdx = card.options.findIndex((o) => o.correct);
  return (
    <div className="ost-wrap" aria-label={fa ? "شناسنامهٔ سؤال" : "Question stats"}>
      <div className="ost-head">
        <span>👥 {fa ? "بقیه چه زدند؟" : "What did others pick?"}</span>
        <span className="small muted">{stats.total.toLocaleString(fa ? "fa-IR" : "en-US")} {fa ? "پاسخ" : "answers"}{stats.avgSec != null && <> · ⏱ {fa ? "میانگین" : "avg"} {stats.avgSec.toLocaleString(fa ? "fa-IR" : "en-US")}{fa ? " ثانیه" : "s"}</>}</span>
      </div>
      {card.options.map((o, i) => {
        const p = stats.pct[i] ?? 0;
        const kind = i === correctIdx ? "ok" : (i === sel ? "bad" : "");
        return (
          <div key={i} className={`ost-row ${kind}`}>
            <span className="ost-letter">{optionLetter(i, lang)}</span>
            <span className="ost-bar"><span style={{ width: `${p}%` }} /></span>
            <b className="ost-pct">{p.toLocaleString(fa ? "fa-IR" : "en-US")}٪</b>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- pre-answer hint ---------- */
export function HintButton({ card, premium, onUsed, onProfile }) {
  const { lang } = useApp();
  const fa = lang === "fa";
  const [hint, setHint] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setHint(null); setErr(null); }, [card?.id]);
  if (!card?.hasHint) return null;
  if (hint) {
    return (
      <div className="hint-box" role="note">
        <div className="hint-title">💡 {fa ? "راهنمای استاد" : "Attending hint"}</div>
        <div className="hint-text">{hint}</div>
      </div>
    );
  }
  const take = async () => {
    if (busy) return; setBusy(true); setErr(null);
    try {
      const r = await api.post(`/learn/card/${card.id}/hint?lang=${lang}`, {});
      setHint(r.hint); onUsed?.(); if (r.gems != null) onProfile?.({ gems: r.gems });
    } catch (e) {
      if (e.status === 402 || /premium/i.test(e.message)) setErr(e.data?.needGems ? (fa ? `برای راهنمایی ${e.data.needGems} جم لازم است.` : `You need ${e.data.needGems} gems for a hint.`) : "premium");
      else setErr(e.message);
    } finally { setBusy(false); }
  };
  return (
    <div className="hint-cta">
      <button type="button" className="btn btn-ghost btn-sm hint-btn" onClick={take} disabled={busy}>
        💡 {fa ? "راهنمایی بگیر" : "Get a hint"} {!premium && <span className="hint-cost">👑</span>}
      </button>
      {err === "premium" && <span className="small muted">{fa ? "راهنمایی قبل از پاسخ، ویژهٔ پرمیوم است." : "Pre-answer hints are a premium perk."}</span>}
      {err && err !== "premium" && <span className="small" style={{ color: "var(--danger)" }}>{err}</span>}
    </div>
  );
}

/* ---------- one-tap flashcard ---------- */
export function SaveFlashcardButton({ cardId, premium, onPremium }) {
  const { lang } = useApp();
  const fa = lang === "fa";
  const [state, setState] = useState("idle"); // idle | busy | done | dup | err
  useEffect(() => { setState("idle"); }, [cardId]);
  const save = async () => {
    if (!premium) { onPremium?.(); return; }
    setState("busy");
    try { const r = await api.post(`/learn/card/${cardId}/save-flashcard?lang=${lang}`, {}); setState(r.duplicate ? "dup" : "done"); }
    catch { setState("err"); }
  };
  const label = state === "done" ? (fa ? "به کارت‌های من اضافه شد ✓" : "Added to My Cards ✓")
    : state === "dup" ? (fa ? "قبلاً در کارت‌های من هست" : "Already in My Cards")
      : state === "err" ? (fa ? "خطا — دوباره تلاش کن" : "Error — try again")
        : (fa ? "ذخیره به‌عنوان فلش‌کارت" : "Save as flashcard");
  return (
    <button type="button" className={`btn btn-sm ${state === "done" ? "btn-accent" : "btn-ghost"} sfc-btn`} onClick={save} disabled={state === "busy" || state === "done" || state === "dup"} title={fa ? "این سؤال و پاسخنامه‌اش را به فلش‌کارت شخصی تبدیل کن (مرور فاصله‌دار)" : "Turn this question + explanation into a personal flashcard (spaced review)"}>
      <Icon name="flask" size={13} /> {label} {!premium && "👑"}
    </button>
  );
}

/* ---------- percentile vs peers (result screens) ---------- */
export function PeerPercentile({ peer, onPremium }) {
  const { lang } = useApp();
  const fa = lang === "fa";
  if (!peer) return null;
  const N = (n) => Number(n ?? 0).toLocaleString(fa ? "fa-IR" : "en-US");
  if (peer.premiumRequired) {
    return (
      <button type="button" className="peer-card peer-locked" onClick={onPremium}>
        <span className="peer-ico">📊</span>
        <span className="peer-body">
          <b>{fa ? "جایگاه تو بین بقیه؟" : "Where do you rank?"}</b>
          <span className="small muted">{fa ? "صدک، میانگین همتایان و مقایسهٔ زمان — ویژهٔ پرمیوم" : "Percentile, peer average and time comparison — premium"}</span>
        </span>
        <span className="tag gold">👑</span>
      </button>
    );
  }
  if (!peer.ready) {
    return <div className="peer-card small muted"><span className="peer-ico">📊</span> {fa ? `مقایسه با همتایان بعد از ${N(peer.min)} شرکت‌کننده فعال می‌شود (فعلاً ${N(peer.peers)}).` : `Peer comparison unlocks after ${N(peer.min)} participants (${N(peer.peers)} so far).`}</div>;
  }
  const faster = peer.mySecPerQ != null && peer.peerSecPerQ != null ? peer.mySecPerQ <= peer.peerSecPerQ : null;
  return (
    <div className="peer-card">
      <div className="peer-main">
        <div className="peer-pct"><b>{N(peer.percentile)}</b><span>{fa ? "صدک" : "percentile"}</span></div>
        <div className="peer-body">
          <b>{fa ? `بهتر از ${N(peer.percentile)}٪ شرکت‌کننده‌ها` : `Better than ${N(peer.percentile)}% of learners`}</b>
          <div className="small muted">{fa ? `نمرهٔ تو ${N(peer.myPct)}٪ · میانگین بقیه ${N(peer.peerAvg)}٪ · ${N(peer.peers)} نفر` : `You ${N(peer.myPct)}% · peers ${N(peer.peerAvg)}% · ${N(peer.peers)} people`}</div>
        </div>
      </div>
      <div className="peer-bars">
        <div className="peer-bar-row"><span>{fa ? "تو" : "You"}</span><span className="peer-bar me"><span style={{ width: `${peer.myPct}%` }} /></span><b>{N(peer.myPct)}٪</b></div>
        <div className="peer-bar-row"><span>{fa ? "بقیه" : "Peers"}</span><span className="peer-bar"><span style={{ width: `${peer.peerAvg}%` }} /></span><b>{N(peer.peerAvg)}٪</b></div>
      </div>
      {peer.mySecPerQ != null && peer.peerSecPerQ != null && (
        <div className={`peer-time ${faster ? "ok" : "slow"}`}>⏱ {fa ? `هر سؤال ${N(peer.mySecPerQ)} ثانیه (بقیه ${N(peer.peerSecPerQ)} ثانیه)` : `${N(peer.mySecPerQ)}s per question (peers ${N(peer.peerSecPerQ)}s)`} {faster ? "🚀" : "🐢"}</div>
      )}
    </div>
  );
}

/* ---------- daily performance report (home) ---------- */
export function DailyReportCard({ go, goToTopic }) {
  const { lang } = useApp();
  const fa = lang === "fa";
  const [d, setD] = useState(null);
  useEffect(() => { api.get(`/learn/daily-report?lang=${lang}`).then(setD).catch(() => setD(null)); }, [lang]);
  if (!d || d.enabled === false) return null;
  const N = (n) => Number(n ?? 0).toLocaleString(fa ? "fa-IR" : "en-US");
  if (d.premiumRequired) {
    return (
      <button type="button" className="card mb16 dr-card dr-locked" onClick={() => go?.("premium")}>
        <div className="mod-ico dr-ico">📈</div>
        <div style={{ flex: 1, minWidth: 0, textAlign: "start" }}>
          <div style={{ fontWeight: 800 }}>{fa ? "گزارش روزانهٔ عملکرد" : "Daily performance report"}</div>
          <div className="small muted">{fa ? "تعداد پاسخ، دقت، زمان و ضعیف‌ترین مبحث امروز — ویژهٔ پرمیوم" : "Answers, accuracy, time and today's weakest topic — premium"}</div>
        </div>
        <span className="tag gold">👑</span>
      </button>
    );
  }
  const r = d.report; if (!r) return null;
  const t = r.today, y = r.yesterday;
  const Delta = ({ v, suffix = "" }) => v === 0 || v == null ? null : <span className={`dr-delta ${v > 0 ? "up" : "down"}`}>{v > 0 ? "▲" : "▼"} {N(Math.abs(v))}{suffix}</span>;
  const max = Math.max(1, ...r.week.map((w) => w.answered));
  return (
    <div className="card mb16 dr-card">
      <div className="dr-head">
        <div className="mod-ico dr-ico">📈</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800 }}>{fa ? "امروزِ تو" : "Your day"}</div>
          <div className="small muted">{fa ? "در مقایسه با دیروز" : "compared with yesterday"}</div>
        </div>
        <div className="dr-spark" aria-hidden="true">
          {r.week.map((w, i) => <span key={w.day} className={`dr-sp ${i === r.week.length - 1 ? "today" : ""}`} style={{ height: `${Math.max(8, Math.round((w.answered / max) * 100))}%` }} title={`${w.day}: ${w.answered}`} />)}
        </div>
      </div>
      <div className="dr-grid">
        <div className="dr-stat"><b>{N(t.answered)}</b><span>{fa ? "پاسخ" : "answers"}</span><Delta v={r.delta.answered} /></div>
        <div className="dr-stat"><b>{t.accuracy == null ? "—" : `${N(t.accuracy)}٪`}</b><span>{fa ? "دقت" : "accuracy"}</span>{t.accuracy != null && y.accuracy != null && <Delta v={r.delta.accuracy} suffix="٪" />}</div>
        <div className="dr-stat"><b>{N(t.minutes)}</b><span>{fa ? "دقیقه" : "minutes"}</span></div>
        <div className="dr-stat"><b>{N(t.xp)}</b><span>XP</span></div>
      </div>
      {r.weak ? (
        <button type="button" className="dr-weak" onClick={() => (goToTopic ? goToTopic(r.weak.slug) : go?.("path"))}>
          <span>🎯 {fa ? "ضعیف‌ترین مبحث امروز:" : "Weakest today:"} <b>{r.weak.name}</b> <span className="muted">({N(r.weak.accuracy)}٪ {fa ? "از" : "of"} {N(r.weak.answered)})</span></span>
          <span className="dr-go">{fa ? "تمرین ←" : "Practice →"}</span>
        </button>
      ) : t.answered === 0 ? (
        <div className="small muted dr-empty">{fa ? "امروز هنوز سؤالی نزدی — یک درس کوتاه، روزت را می‌سازد." : "No answers yet today — one short lesson makes the day."}</div>
      ) : null}
    </div>
  );
}
