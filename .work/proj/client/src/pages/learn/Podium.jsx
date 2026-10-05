import { useApp } from "../../context.jsx";

/* ---------------------------------------------------------------------------
   Podium — a top-3 winners' podium (gold / silver / bronze pedestals) rendered
   above a leaderboard. Reuses the app's existing, polished podium styles
   (.podium / .podium-col.rank-N / .podium-bar …) from styles.css so it matches
   the exam Leaderboard exactly. Takes the top rows [{rank,name,xp,user_id?}]
   and an optional `meId` to highlight the viewer.
--------------------------------------------------------------------------- */
const MEDALS = { 1: "🥇", 2: "🥈", 3: "🥉" };
const HEIGHTS = { 1: 92, 2: 66, 3: 48 };
const letter = (name = "") => (String(name).trim()[0] || "؟");

export default function Podium({ top = [], meId = null }) {
  const { lang } = useApp();
  const fa = lang !== "en";
  const three = top.slice(0, 3);
  if (three.length < 3) return null;                 // need a full podium
  const order = [three[1], three[0], three[2]];      // display 2 · 1 · 3

  return (
    <div className="podium podium-standalone" role="img" aria-label={fa ? "سه نفر برتر" : "Top three"}>
      {order.map((m) => {
        const isMe = meId != null && m.user_id === meId;
        return (
          <div key={m.user_id ?? m.rank} className={`podium-col rank-${m.rank} ${isMe ? "me" : ""}`}>
            <div className="podium-avatar">
              <span className="podium-ava-letter">{letter(m.name)}</span>
              <span className="podium-medal">{MEDALS[m.rank]}</span>
              {m.rank === 1 && <span className="podium-crown">👑</span>}
            </div>
            <div className="podium-name" title={m.name}>{m.name}{isMe ? ` (${fa ? "شما" : "you"})` : ""}</div>
            <div className="podium-score">{m.xp} <span style={{ fontSize: ".7rem", opacity: .7 }}>XP</span></div>
            <div className="podium-bar" style={{ "--h": `${HEIGHTS[m.rank]}px` }}>
              {m.rank === 1 && <span className="podium-shine" />}
              <span className="podium-rank">{m.rank}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
