import { useEffect, useState } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";
import Avatar from "../../components/Avatar.jsx";
import { GemIcon, StreakIcon } from "../../components/StatIcons.jsx";
import { TierBadge } from "./TierBadge.jsx";

/* Friends / social hub (Duolingo-style):
   • friend streaks (shared daily habit) + nudge
   • friend quests (weekly shared XP goal → gems)
   • discover / search + follow
   • activity feed with high-fives
   • friends leaderboard */
export default function Friends({ onProfile }) {
  const { t, lang } = useApp();
  const [sub, setSub] = useState("friends"); // friends | discover | feed | board
  const [data, setData] = useState(null);
  const [feed, setFeed] = useState([]);
  const [busy, setBusy] = useState("");

  const load = async () => {
    const [d, f] = await Promise.all([
      api.get(`/learn/friends?lang=${lang}`).catch(() => null),
      api.get(`/learn/friends/feed?lang=${lang}`).catch(() => ({ feed: [] })),
    ]);
    setData(d); setFeed(f.feed || []);
  };
  useEffect(() => { load(); }, [lang]);

  const act = async (fn, key) => { setBusy(key); try { await fn(); await load(); } catch (e) { /* */ } finally { setBusy(""); } };
  const doFollow = (id) => act(() => api.post(`/learn/friends/follow/${id}`, {}), "f" + id);
  const doUnfollow = (id) => act(() => api.post(`/learn/friends/unfollow/${id}`, {}), "u" + id);
  const doNudge = (id) => act(() => api.post(`/learn/friends/nudge/${id}`, {}), "n" + id);
  const doQuest = (id) => act(() => api.post(`/learn/friends/quest/${id}`, {}), "q" + id);
  const claimQuest = (id) => act(async () => { const r = await api.post(`/learn/friends/quest/${id}/claim`, {}); onProfile?.(r.profile); }, "cq" + id);
  const highFive = (id) => act(() => api.post(`/learn/friends/feed/${id}/highfive`, {}), "h" + id);

  if (!data) return <div className="card"><div className="skeleton" style={{ height: 160 }} /></div>;

  const tabs = [["friends", "users", t("friends")], ["discover", "search", t("discover")], ["feed", "activity", t("feed")], ["board", "chart", t("friendsBoard")]];

  return (
    <div className="page">
      <div className="section-title"><h2><Icon name="users" size={22} /> {t("friends")}</h2></div>
      <div className="ad-slot-tabs mb16">
        {tabs.map(([id, ic, label]) => (
          <button key={id} className={`btn btn-sm ${sub === id ? "btn-primary" : "btn-ghost"}`} onClick={() => setSub(id)}>
            <Icon name={ic} size={14} /> {label}
          </button>
        ))}
      </div>

      {sub === "friends" && <FriendsTab data={data} t={t} lang={lang} busy={busy}
        doNudge={doNudge} doQuest={doQuest} claimQuest={claimQuest} doUnfollow={doUnfollow} />}
      {sub === "discover" && <DiscoverTab t={t} lang={lang} busy={busy} doFollow={doFollow} doUnfollow={doUnfollow} />}
      {sub === "feed" && <FeedTab feed={feed} t={t} busy={busy} highFive={highFive} />}
      {sub === "board" && <BoardTab board={data.leaderboard} t={t} />}
    </div>
  );
}

function FriendsTab({ data, t, lang, busy, doNudge, doQuest, claimQuest, doUnfollow }) {
  const friends = (data.following || []).filter((f) => f.friend);
  const streakMap = new Map((data.streaks?.streaks || []).map((s) => [s.friendId, s]));
  const questMap = new Map((data.quests || []).map((q) => [q.partnerId, q]));
  return (
    <>
      {/* Friend streaks summary */}
      {data.streaks?.streaks?.length > 0 && (
        <div className="card mb16">
          <div className="section-title"><h4><StreakIcon size={16} /> {t("friendStreaks")}</h4>
            <span className="tag">{data.streaks.streaks.length}/{data.streaks.max}</span></div>
          <div className="small muted mb8">{t("friendStreakHint")}</div>
          {data.streaks.streaks.map((s) => (
            <div className="friend-row" key={s.friendId}>
              <Avatar name={s.name} streak={s.streak} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{s.name}</div>
                <div className="small muted"><StreakIcon size={13} /> {s.streak} {t("dayStreak")} · {s.friendDoneToday ? `✅ ${t("friendDoneToday")}` : `⏳ ${t("friendNotDone")}`}</div>
              </div>
              {s.canNudge && <button className="btn btn-accent btn-sm" disabled={busy === "n" + s.friendId} onClick={() => doNudge(s.friendId)}>👋 {t("nudge")}</button>}
            </div>
          ))}
        </div>
      )}

      {/* Friends list + per-friend quest control */}
      <div className="card mb16">
        <div className="section-title"><h4><Icon name="users" size={18} /> {t("myFriends")}</h4></div>
        {friends.length === 0 && <div className="small muted">{t("noFriendsYet")}</div>}
        {friends.map((f) => {
          const q = questMap.get(f.id);
          return (
            <div className="friend-row" key={f.id}>
              <Avatar name={f.name} streak={f.friendStreak} tier={f.tier} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{f.name} {f.friendStreak > 0 && <span className="tag"><StreakIcon size={12} /> {f.friendStreak}</span>}</div>
                <div className="small muted">{f.xp} {t("xp")} · <TierBadge tier={f.tier} size={12} /></div>
              </div>
              {q ? (
                q.claimed ? <span className="tag done">✓ {t("claimed")}</span>
                  : q.complete ? <button className="btn btn-accent btn-sm" disabled={busy === "cq" + q.id} onClick={() => claimQuest(q.id)}><GemIcon size={14} /> +{q.reward_gems}</button>
                    : <span className="tag" title={t("questInProgress")}>🤝 {q.total}/{q.goal}</span>
              ) : (
                <button className="btn btn-primary btn-sm" disabled={busy === "q" + f.id} onClick={() => doQuest(f.id)}>🤝 {t("startFriendQuest")}</button>
              )}
              <button className="btn btn-ghost btn-sm" disabled={busy === "u" + f.id} onClick={() => doUnfollow(f.id)} title={t("unfollow")}><Icon name="close" size={13} /></button>
            </div>
          );
        })}
      </div>

      {/* Friend quests detail (progress bars) */}
      {data.quests?.length > 0 && (
        <div className="card">
          <div className="section-title"><h4>🤝 {t("friendQuests")}</h4></div>
          {data.quests.map((q) => (
            <div className="quest-row" key={q.id}>
              <div className="quest-ico"><Icon name="trophy" size={20} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{t("with")} {q.partner} ({q.total}/{q.goal} XP)</div>
                <div className="pbar sm"><span style={{ width: `${Math.min(100, Math.round((q.total / q.goal) * 100))}%` }} /></div>
                <div className="small muted" style={{ marginTop: 4 }}>{t("you")}: {q.myXp} · {q.partner}: {q.partnerXp}</div>
              </div>
              <div className="quest-reward">
                {q.claimed ? <span className="tag done">✓</span>
                  : q.complete ? <button className="btn btn-accent btn-sm" disabled={busy === "cq" + q.id} onClick={() => claimQuest(q.id)}><GemIcon size={14} /> +{q.reward_gems}</button>
                    : <span className="tag"><GemIcon size={14} /> {q.reward_gems}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function DiscoverTab({ t, lang, busy, doFollow, doUnfollow }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    const id = setTimeout(() => {
      api.get(`/learn/friends/search?q=${encodeURIComponent(q)}&lang=${lang}`)
        .then((d) => setResults(d.results || [])).catch(() => setResults([])).finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(id);
  }, [q, lang, busy]);
  return (
    <div className="card">
      <div className="section-title"><h4><Icon name="search" size={18} /> {t("findFriends")}</h4></div>
      <div className="small muted mb8">{t("findFriendsHint")}</div>
      <div className="field"><input placeholder={t("searchByName")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {loading && <div className="small muted">…</div>}
      {!loading && q.trim() && results.length === 0 && <div className="small muted">{t("noData")}</div>}
      {results.map((u) => (
        <div className="friend-row" key={u.id}>
          <Avatar name={u.name} streak={u.streak} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700 }}>{u.name} {u.followsMe && <span className="tag small">{t("followsYou")}</span>}</div>
            <div className="small muted">{u.xp} {t("xp")} · <StreakIcon size={12} /> {u.streak}</div>
          </div>
          {u.following
            ? <button className="btn btn-ghost btn-sm" disabled={busy === "u" + u.id} onClick={() => doUnfollow(u.id)}>{t("following2")}</button>
            : <button className="btn btn-primary btn-sm" disabled={busy === "f" + u.id} onClick={() => doFollow(u.id)}><Icon name="check" size={13} /> {t("follow")}</button>}
        </div>
      ))}
    </div>
  );
}

function FeedTab({ feed, t, busy, highFive }) {
  return (
    <div className="card">
      <div className="section-title"><h4><Icon name="activity" size={18} /> {t("feed")}</h4></div>
      {feed.length === 0 && <div className="small muted">{t("feedEmpty")}</div>}
      {feed.map((e) => (
        <div className="feed-item" key={e.id}>
          <Avatar name={e.name} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div><b>{e.isMe ? t("you") : e.name}</b> {e.title}</div>
            {e.highfives > 0 && <div className="small muted">🙌 {e.highfives}</div>}
          </div>
          {!e.isMe && (
            <button className={`btn btn-sm ${e.hifived ? "btn-accent" : "btn-ghost"}`} disabled={e.hifived || busy === "h" + e.id} onClick={() => highFive(e.id)}>
              🙌 {e.hifived ? t("hifived") : t("highfive")}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function BoardTab({ board, t }) {
  return (
    <div className="card">
      <div className="section-title"><h4><Icon name="chart" size={18} /> {t("friendsBoard")}</h4></div>
      <div className="small muted mb8">{t("friendsBoardHint")}</div>
      {(board || []).map((r) => (
        <div key={r.id} className={`case-item ${r.isMe ? "me-row" : ""}`} style={{ marginTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontWeight: 900, width: 26, color: "var(--xp)" }}>#{r.rank}</span>
            <Avatar name={r.name} streak={r.streak} />
            <div><div style={{ fontWeight: 700 }}>{r.isMe ? `${r.name} (${t("you")})` : r.name}</div>
              <div className="small muted"><StreakIcon size={12} /> {r.streak}</div></div>
          </div>
          <span className="tag"><Icon name="medal" size={14} /> {r.weeklyXp} {t("xp")}</span>
        </div>
      ))}
    </div>
  );
}
