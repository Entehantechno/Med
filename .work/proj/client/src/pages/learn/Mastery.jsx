import { useEffect, useState } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";

/* Topic Mastery page — Bloom's Mastery Learning + durable memory.
   Shows every topic in the active program with either an earned mastery badge
   or a clear, honest progress-toward-mastery breakdown (accuracy, answers,
   durable-memory share). No sticker theatre: a badge is only shown when the
   real criteria are met. */
export default function Mastery({ onBack }) {
  const { t, lang } = useApp();
  const [data, setData] = useState(null);

  useEffect(() => { api.get(`/learn/mastery?lang=${lang}`).then(setData).catch(() => setData({ topics: [] })); }, [lang]);

  if (!data) return <div className="card"><div className="skeleton" style={{ height: 200 }} /></div>;
  const topics = data.topics || [];

  return (
    <div className="page">
      <div className="section-title">
        <h2><Icon name="medal" size={22} /> {t("masteryTitle")}</h2>
        {onBack && <button className="btn btn-ghost btn-sm" onClick={onBack}>← {t("back")}</button>}
      </div>
      <div className="muted small mb16">{t("masteryHint")}</div>

      {topics.length > 0 && (
        <div className="mastery-summary card mb16">
          <div className="ms-count">🏅 <b>{fmt(data.mastered, lang)}</b> / {fmt(data.total, lang)}</div>
          <div className="small muted">{t("masteryEarnedCount")}</div>
        </div>
      )}

      {topics.length === 0 ? (
        <div className="card empty-state"><div className="ico"><Icon name="medal" size={30} /></div>
          <h3>{t("masteryEmpty")}</h3><div className="muted small mt8">{t("masteryEmptyDesc")}</div></div>
      ) : (
        <div className="grid grid-2">
          {topics.map((tp) => <MasteryCard key={tp.topicId} tp={tp} />)}
        </div>
      )}
    </div>
  );
}

function MasteryCard({ tp }) {
  const { t, lang } = useApp();
  const accPct = Math.min(100, Math.round((tp.accuracy / Math.max(1, tp.needAccuracy)) * 100));
  return (
    <div className={`card mastery-card ${tp.mastered ? "mastered" : ""}`}>
      <div className="mc-head">
        <span className="mc-ico" style={{ background: tp.color || "var(--primary)" }}>
          <Icon name={tp.icon || "flask"} size={18} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mc-name">{tp.name}</div>
          <div className="small muted">{t("masterySeen").replace("{s}", fmt(tp.seen, lang)).replace("{n}", fmt(tp.total, lang))}</div>
        </div>
        {tp.mastered && <span className="mc-badge" title={t("masteryBadge")}>🏅</span>}
      </div>

      {tp.mastered ? (
        <div className="mc-done">
          ✅ {t("masteryDone").replace("{a}", fmt(tp.accuracy, lang))}
        </div>
      ) : (
        <div className="mc-progress">
          {/* accuracy toward the criterion */}
          <div className="mc-row">
            <span className="mc-lbl">🎯 {t("accuracy")}</span>
            <div className="mc-bar"><span style={{ width: `${accPct}%`, background: tp.accuracy >= tp.needAccuracy ? "var(--primary)" : "var(--gold)" }} /></div>
            <span className="mc-val">{fmt(tp.accuracy, lang)}٪ / {fmt(tp.needAccuracy, lang)}٪</span>
          </div>
          {/* answered enough cards */}
          <div className="mc-row">
            <span className="mc-lbl">📝 {t("masteryAnswered")}</span>
            <div className="mc-bar"><span style={{ width: `${Math.min(100, Math.round((tp.seen / Math.max(1, tp.needAnswers)) * 100))}%` }} /></div>
            <span className="mc-val">{fmt(tp.seen, lang)} / {fmt(tp.needAnswers, lang)}</span>
          </div>
          {/* durable memory */}
          {tp.needMatureRatio > 0 && (
            <div className="mc-row">
              <span className="mc-lbl">🧠 {t("masteryDurable")}</span>
              <div className="mc-bar"><span style={{ width: `${Math.min(100, Math.round((tp.matureRatio / Math.max(1, tp.needMatureRatio)) * 100))}%` }} /></div>
              <span className="mc-val">{fmt(tp.matureRatio, lang)}٪ / {fmt(tp.needMatureRatio, lang)}٪</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function fmt(n, lang) { return (n ?? 0).toLocaleString(lang === "fa" ? "fa-IR" : "en-US"); }
