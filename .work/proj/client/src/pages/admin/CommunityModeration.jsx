import { useEffect, useState } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";
import { Spinner, useToast } from "../../components/UI.jsx";
import { fmtDate } from "../../utils/date.js";

/* Admin moderation for Community Decks: approve or reject learner-shared cards
   before they go public. Keeps quality high (the network-effect feature). */
export default function CommunityModeration() {
  const { t, lang } = useApp();
  const toast = useToast();
  const [queue, setQueue] = useState(null);
  const [stats, setStats] = useState({});

  const load = () => api.get(`/admin/community/queue?lang=${lang}`)
    .then((d) => { setQueue(d.queue); setStats(d.stats || {}); })
    .catch(() => setQueue([]));
  useEffect(() => { load(); }, [lang]);

  const act = async (id, action) => {
    await api.post(`/admin/community/${id}/moderate`, { action });
    toast(t("saved"));
    load();
  };

  if (!queue) return <Spinner />;

  return (
    <div className="page">
      <div className="section-title"><h2>👥 {t("communityModeration")}</h2></div>
      <div className="muted small mb16">{t("communityModerationHint")}</div>

      <div className="case-meta mb16" style={{ flexWrap: "wrap" }}>
        <span className="tag">⏳ {t("pending")}: {stats.pending || 0}</span>
        <span className="tag" style={{ color: "var(--accent2)" }}>✅ {t("approved")}: {stats.approved || 0}</span>
        <span className="tag" style={{ color: "var(--danger)" }}>✖ {t("rejected")}: {stats.rejected || 0}</span>
      </div>

      {queue.length === 0 ? (
        <div className="card empty-state"><div className="ico">✅</div><h3>{t("communityQueueEmpty")}</h3></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {queue.map((q) => (
            <div key={q.id} className="card">
              <div style={{ fontWeight: 700 }}>{q.card.q}</div>
              {q.card.type === "mcq" && q.card.options && (
                <ul className="cc-opts">
                  {q.card.options.map((o, i) => <li key={i} className={o.correct ? "ok" : ""}>{o.correct ? "✓ " : "• "}{o.text}</li>)}
                </ul>
              )}
              {q.card.micro?.lead && <div className="small muted mt8">📖 {q.card.micro.lead}</div>}
              <div className="case-meta mt8"><span className="tag"><Icon name="user" size={12} /> {q.author}</span><span className="tag">{fmtDate(q.created_at, lang)}</span></div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button className="btn btn-accent btn-sm" onClick={() => act(q.id, "approve")}><Icon name="check" size={13} /> {t("approve")}</button>
                <button className="btn btn-danger btn-sm" onClick={() => act(q.id, "reject")}><Icon name="close" size={13} /> {t("reject")}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
