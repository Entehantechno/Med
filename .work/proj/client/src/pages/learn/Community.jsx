import { useEffect, useState } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";
import { Modal } from "../../components/UI.jsx";

/* Community Decks — browse learner-shared, admin-approved cards; upvote the
   best; import them into your own SRS. A network-effect feature competitors
   don't offer. You can also share your own cards (they enter moderation). */
export default function Community({ onBack }) {
  const { t, lang } = useApp();
  const [cards, setCards] = useState(null);
  const [sort, setSort] = useState("top");
  const [mine, setMine] = useState([]);       // my own cards, to share
  const [shareOpen, setShareOpen] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () => api.get(`/learn/community?sort=${sort}&lang=${lang}`).then((d) => setCards(d.cards)).catch(() => setCards([]));
  useEffect(() => { load(); }, [sort, lang]);

  const vote = async (id, value) => {
    try {
      const r = await api.post(`/learn/community/${id}/vote`, { value });
      setCards((cs) => cs.map((c) => c.id === id ? { ...c, score: r.score, myVote: r.myVote } : c));
    } catch { /* */ }
  };
  const doImport = async (id) => {
    try { await api.post(`/learn/community/${id}/import`, {}); setCards((cs) => cs.map((c) => c.id === id ? { ...c, imported: true, imports: c.imports + 1 } : c)); }
    catch { /* */ }
  };
  const openShare = () => {
    api.get(`/learn/mycards?lang=${lang}`).then((d) => setMine(d.cards || [])).catch(() => setMine([]));
    setShareOpen(true); setMsg("");
  };
  const share = async (fid, topicId) => {
    try {
      const r = await api.post("/learn/community/share", { flashcardId: fid, topicId });
      setMsg(r.already ? (lang === "fa" ? "قبلاً به اشتراک گذاشته‌ای" : "Already shared") : (lang === "fa" ? "ارسال شد؛ در انتظار تأیید مدیر." : "Submitted; awaiting admin approval."));
    } catch (e) { setMsg(e.message); }
  };

  if (!cards) return <div className="card"><div className="skeleton" style={{ height: 200 }} /></div>;

  return (
    <div className="page">
      <div className="section-title">
        <h2>👥 {t("community")}</h2>
        <button className="btn btn-primary btn-sm" onClick={openShare}><Icon name="upload" size={14} /> {t("communityShare")}</button>
      </div>
      <div className="muted small mb16">{t("communityHint")}</div>

      <div className="ad-slot-tabs mb16">
        <button className={`btn btn-sm ${sort === "top" ? "btn-primary" : "btn-ghost"}`} onClick={() => setSort("top")}>🔝 {t("communityTop")}</button>
        <button className={`btn btn-sm ${sort === "new" ? "btn-primary" : "btn-ghost"}`} onClick={() => setSort("new")}>🆕 {t("communityNew")}</button>
      </div>

      {cards.length === 0 && <div className="card empty-state"><div className="ico">👥</div><h3>{t("communityEmpty")}</h3><div className="small muted">{t("communityEmptyHint")}</div></div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {cards.map((c) => (
          <div key={c.id} className="card cc-card">
            <div className="cc-vote">
              <button className={`cc-arrow ${c.myVote === 1 ? "on" : ""}`} onClick={() => vote(c.id, 1)} title={t("upvote")}>▲</button>
              <span className="cc-score">{c.score}</span>
              <button className={`cc-arrow down ${c.myVote === -1 ? "on" : ""}`} onClick={() => vote(c.id, -1)} title={t("downvote")}>▼</button>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{c.card.q}</div>
              {c.card.type === "mcq" && c.card.options && (
                <ul className="cc-opts">
                  {c.card.options.map((o, i) => <li key={i} className={o.correct ? "ok" : ""}>{o.correct ? "✓ " : "• "}{o.text}</li>)}
                </ul>
              )}
              <div className="case-meta mt8" style={{ flexWrap: "wrap" }}>
                <span className="tag"><Icon name="user" size={12} /> {c.author}</span>
                <span className="tag">⬇️ {c.imports}</span>
                {c.mine && <span className="tag">{t("communityYours")}</span>}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center" }}>
              {c.imported
                ? <span className="tag" style={{ background: "var(--accentGlow)" }}>✓ {t("communityImported")}</span>
                : <button className="btn btn-accent btn-sm" onClick={() => doImport(c.id)}><Icon name="download" size={13} /> {t("communityImport")}</button>}
            </div>
          </div>
        ))}
      </div>

      {shareOpen && (
        <Modal title={t("communityShareTitle")} onClose={() => setShareOpen(false)}>
          <div className="small muted mb8">{t("communityShareHint")}</div>
          {msg && <div className="card center mb8"><span className="code-pill">{msg}</span></div>}
          {mine.length === 0
            ? <div className="empty-state"><div className="ico">📝</div><h3>{t("communityNoCards")}</h3></div>
            : <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 340, overflow: "auto" }}>
                {mine.map((m) => (
                  <div key={m.linkId} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span style={{ minWidth: 0 }}>{m.q}</span>
                    <button className="btn btn-primary btn-sm" onClick={() => share(m.id, m.topic_id)}><Icon name="upload" size={13} /> {t("communityShare")}</button>
                  </div>
                ))}
              </div>}
        </Modal>
      )}

      <button className="btn btn-ghost btn-block mt16" onClick={onBack}>{t("back")}</button>
    </div>
  );
}
