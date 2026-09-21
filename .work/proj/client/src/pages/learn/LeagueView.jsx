import { useEffect, useState } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";
import Avatar from "../../components/Avatar.jsx";
import { TierBadge } from "./TierBadge.jsx";
import Podium from "./Podium.jsx";

export default function LeagueView() {
  const { t, lang } = useApp();
  const [data, setData] = useState(null);
  const [tour, setTour] = useState(null);
  useEffect(() => {
    api.get(`/learn/league?lang=${lang}`).then(setData).catch(() => setData({ members: [] }));
    api.get(`/learn/tournament?lang=${lang}`).then(setTour).catch(() => setTour(null));
  }, [lang]);
  if (!data) return <div className="card"><div className="skeleton" style={{ height: 200 }} /></div>;

  // Calm Mode: the learner opted out of competition — show a supportive message.
  if (data.optedOut) return (
    <div className="page">
      <div className="section-title"><h2><Icon name="trophy" size={22} /> {t("weeklyLeague")}</h2></div>
      <div className="card empty-state"><div className="ico">🌿</div>
        <h3>{t("calmLeagueOptOut")}</h3>
        <div className="muted small mt8">{t("calmLeagueOptOutDesc")}</div>
      </div>
    </div>
  );

  return (
    <div className="page">
      <div className="section-title"><h2><Icon name="trophy" size={22} /> {t("weeklyLeague")}</h2><TierBadge tier={data.tier} /></div>
      <div className="muted small mb16">{t("leagueDesc")}</div>

      {/* Diamond Tournament — elite bracket for diamond-tier learners */}
      {tour?.enabled && tour?.qualified && (
        <div className="card mb16 tournament-card">
          <div className="section-title"><h4>💎 {t("diamondTournament")}</h4>
            <span className="tag" style={{ background: "var(--accentGlow)" }}>{tour.stageLabel}</span></div>
          <div className="small muted mb8">{t("tournamentHint").replace("{n}", tour.advance)}</div>
          <div className="tournament-grid">
            {tour.members.map((m) => {
              const isMe = m.user_id === tour.me;
              const zc = m.zone === "champion" ? "var(--gold)" : m.zone === "advance" ? "var(--green)" : "var(--danger)";
              return (
                <div key={m.user_id} className="tour-row" style={{ borderInlineStart: `4px solid ${zc}`, background: isMe ? "var(--primaryGlow)" : "transparent" }}>
                  <span style={{ fontWeight: 900, width: 26, color: m.rank <= 3 ? "var(--gold)" : "var(--muted)" }}>
                    {m.rank <= 3 ? ["🥇", "🥈", "🥉"][m.rank - 1] : m.rank}
                  </span>
                  <Avatar name={m.name} size={30} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: isMe ? 800 : 700 }}>{m.name}{m.anon ? " 🕶️" : ""}{isMe ? ` (${lang === "fa" ? "شما" : "you"})` : ""} {m.wins > 0 && <span className="tag small">🏆 {m.wins}</span>}</div>
                  </div>
                  {tour.isFinal && m.zone === "champion" && <span className="tag" style={{ background: "var(--gold)", color: "#3a2c00" }}>{t("champion")}</span>}
                  <span className="tag" style={{ fontWeight: 800 }}><Icon name="medal" size={12} /> {m.xp}</span>
                </div>
              );
            })}
          </div>
          <div className="small muted mt8">
            {tour.isFinal
              ? `🏆 ${t("tournamentFinalNote").replace("{g1}", tour.podiumGems?.[0] || 0)}`
              : `⬆️ ${t("tournamentAdvanceNote").replace("{n}", tour.advance)}`}
          </div>
        </div>
      )}
      {tour?.enabled && tour?.qualified === false && data.tier === "diamond" && (
        <div className="card mb16 small muted">💎 {t("tournamentSoon")}</div>
      )}

      {/* Top-3 podium for the weekly league (gold/silver/bronze) */}
      <Podium top={data.members} meId={data.me} />

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {data.members.map((m) => {
          const isMe = m.user_id === data.me;
          const zoneColor = m.zone === "promote" ? "var(--green)" : m.zone === "relegate" ? "var(--danger)" : "transparent";
          return (
            <div key={m.user_id} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
              borderInlineStart: `4px solid ${zoneColor}`,
              background: isMe ? "var(--primaryGlow)" : "transparent",
              borderBottom: "1px solid var(--border)",
            }}>
              <span style={{ fontWeight: 900, width: 28, color: m.rank <= 3 ? "var(--xp)" : "var(--muted)" }}>
                {m.rank <= 3 ? ["🥇", "🥈", "🥉"][m.rank - 1] : m.rank}
              </span>
              <Avatar name={m.name} size={34} streak={m.streak} tier={m.tier} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: isMe ? 800 : 700 }}>{m.name}{m.anon ? " 🕶️" : ""}{isMe ? ` (${lang === "fa" ? "شما" : "you"})` : ""}</div>
                <div className="small muted">{m.province} · <Icon name="clock" size={11} /> {m.streak}</div>
              </div>
              <span className="tag" style={{ fontWeight: 800 }}><Icon name="medal" size={13} /> {m.xp}</span>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap", fontSize: ".82rem" }}>
        <span><span style={{ display: "inline-block", width: 12, height: 12, background: "var(--green)", borderRadius: 3, verticalAlign: "middle" }} /> {t("promoteZone")}</span>
        <span><span style={{ display: "inline-block", width: 12, height: 12, background: "var(--danger)", borderRadius: 3, verticalAlign: "middle" }} /> {t("relegateZone")}</span>
      </div>
    </div>
  );
}
