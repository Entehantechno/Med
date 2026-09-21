import { useEffect, useState } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";

/* Crowd difficulty insights: difficulty learned from real answer data, not a
   fixed label. Shows the hardest questions (lowest pass rate) so learners can
   drill exactly what most people miss. NO AI. */
const KEY_LABEL = { easy: ["آسان", "Easy"], medium: ["متوسط", "Medium"], hard: ["سخت", "Hard"], brutal: ["بسیار سخت", "Brutal"] };
const KEY_COLOR = { easy: "#22c55e", medium: "#38bdf8", hard: "#f59e0b", brutal: "#f87171" };

export default function CrowdInsights({ onBack }) {
  const { t, lang } = useApp();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get(`/learn/crowd/hardest?lang=${lang}`).then(setData).catch(() => setData({ cards: [], summary: {} }));
  }, [lang]);

  if (!data) return <div className="card"><div className="skeleton" style={{ height: 200 }} /></div>;
  const summary = data.summary || {};
  const buckets = summary.buckets || {};
  const cards = Array.isArray(data.cards) ? data.cards : [];
  const label = (k) => (lang === "fa" ? KEY_LABEL[k]?.[0] : KEY_LABEL[k]?.[1]) || k;
  const color = (k) => KEY_COLOR[k] || "#647184";

  return (
    <div className="page">
      <div className="section-title"><h2>📉 {t("crowdInsights")}</h2></div>
      <div className="muted small mb16">{t("crowdInsightsHint")}</div>

      <div className="card mb16">
        <div className="case-meta" style={{ flexWrap: "wrap" }}>
          <span className="tag"><Icon name="deck" size={13} /> {t("crowdRatedCards")}: {summary.ratedCards || 0}</span>
          <span className="tag"><Icon name="users" size={13} /> {t("crowdAnswers")}: {summary.totalAnswers || 0}</span>
        </div>
        <div className="crowd-bars mt16">
          {["easy", "medium", "hard", "brutal"].map((k) => {
            const total = (buckets.easy || 0) + (buckets.medium || 0) + (buckets.hard || 0) + (buckets.brutal || 0) || 1;
            const pct = Math.round(((buckets[k] || 0) / total) * 100);
            return (
              <div key={k} className="crowd-bar-row">
                <span className="crowd-bar-label" style={{ color: color(k) }}>{label(k)}</span>
                <div className="crowd-bar"><span style={{ width: `${pct}%`, background: color(k) }} /></div>
                <span className="small muted">{buckets[k] || 0}</span>
              </div>
            );
          })}
        </div>
      </div>

      <h4 className="mb8">🔥 {t("crowdHardest")}</h4>
      {cards.length === 0
        ? <div className="card empty-state"><div className="ico">📊</div><h3>{t("crowdEmpty")}</h3></div>
        : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {cards.map((c, i) => (
              <div key={c.id} className="card crowd-item">
                <div className="crowd-rank">#{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{c.q}</div>
                  <div className="case-meta mt8" style={{ flexWrap: "wrap" }}>
                    {c.topic && <span className="tag">{c.topic.emoji} {c.topic.title}</span>}
                    <span className="tag" style={{ background: color(c.key) + "22", borderColor: color(c.key), color: color(c.key) }}>{label(c.key)}</span>
                    <span className="tag">✅ {c.passRate}% {t("crowdPassRate")}</span>
                    <span className="tag">👥 {c.seen}</span>
                    <span className="tag">⏱️ {c.avgSec}s</span>
                  </div>
                </div>
              </div>
            ))}
          </div>}
      <button className="btn btn-ghost btn-block mt16" onClick={onBack}>{t("back")}</button>
    </div>
  );
}
