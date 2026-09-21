import { useEffect, useState } from "react";
import { useApp } from "../../context.jsx";
import { api } from "../../api.js";
import Icon from "../../components/Icon.jsx";
import { GemIcon, XpIcon, StreakIcon } from "../../components/StatIcons.jsx";

/* Gamification hub: daily goal, daily quests, timed chests, gem shop,
   streak calendar and personal records — the retention engine in one place. */
export default function Quests({ onProfile }) {
  const { t, lang, flag } = useApp();
  const [daily, setDaily] = useState(null);
  const [quests, setQuests] = useState([]);
  const [chests, setChests] = useState([]);
  const [shop, setShop] = useState(null);
  const [streak, setStreak] = useState(null);
  const [wager, setWager] = useState(null);
  const [monthly, setMonthly] = useState(null);
  const [badges, setBadges] = useState([]);
  const [revival, setRevival] = useState(null);
  const [busy, setBusy] = useState("");

  const loadAll = async () => {
    const [d, q, c, s, st, w, m, rv] = await Promise.all([
      api.get(`/learn/daily?lang=${lang}`).catch(() => null),
      api.get(`/learn/quests?lang=${lang}`).catch(() => ({ quests: [] })),
      api.get(`/learn/chests?lang=${lang}`).catch(() => ({ chests: [] })),
      api.get(`/learn/shop?lang=${lang}`).catch(() => null),
      api.get(`/learn/streak?lang=${lang}`).catch(() => null),
      api.get(`/learn/wager?lang=${lang}`).catch(() => null),
      api.get(`/learn/monthly?lang=${lang}`).catch(() => null),
      api.get(`/learn/revival?lang=${lang}`).catch(() => null),
    ]);
    setDaily(d); setQuests(q.quests || []); setChests(c.chests || []); setShop(s); setStreak(st);
    setWager(w); setMonthly(m?.monthly || null); setBadges(m?.badges || []); setRevival(rv);
  };
  useEffect(() => { loadAll(); }, [lang]);

  const placeWager = async () => {
    setBusy("wager");
    try { const r = await api.post("/learn/wager", {}); onProfile?.(r.profile); await loadAll(); }
    catch (e) { alert(lang === "fa" ? "جم کافی نیست" : "Not enough gems"); } finally { setBusy(""); }
  };
  const claimMonthly = async () => {
    setBusy("monthly");
    try { const r = await api.post("/learn/monthly/claim", {}); onProfile?.(r.profile); await loadAll(); }
    catch (e) { /* */ } finally { setBusy(""); }
  };
  const claimRevival = async () => {
    setBusy("revival");
    try { const r = await api.post("/learn/revival/claim", {}); onProfile?.(r.profile); await loadAll(); }
    catch (e) { /* */ } finally { setBusy(""); }
  };

  const setGoal = async (value) => {
    const { profile } = await api.post("/learn/daily/goal", { value });
    onProfile?.(profile); loadAll();
  };
  const claim = async (id) => {
    setBusy("q" + id);
    try { const r = await api.post(`/learn/quests/${id}/claim`, {}); onProfile?.(r.profile); await loadAll(); }
    finally { setBusy(""); }
  };
  const openChest = async (slug) => {
    setBusy("c" + slug);
    try { const r = await api.post(`/learn/chests/${slug}/open`, {}); onProfile?.(r.profile); await loadAll(); }
    catch (e) { /* not available */ } finally { setBusy(""); }
  };
  const buy = async (slug) => {
    setBusy("s" + slug);
    try { const r = await api.post("/learn/shop/buy", { slug }); onProfile?.(r.profile); await loadAll(); }
    catch (e) { alert(lang === "fa" ? "جم کافی نیست" : "Not enough gems"); } finally { setBusy(""); }
  };

  if (!daily) return <div className="card"><div className="skeleton" style={{ height: 120 }} /></div>;
  const goalPct = Math.min(100, Math.round(((daily.today || 0) / (daily.goal || 30)) * 100));

  return (
    <div className="page">
      <div className="section-title"><h2><Icon name="target" size={22} /> {t("questsHub")}</h2></div>

      {/* Streak Revival — free comeback for a lost streak (shown only when eligible) */}
      {flag("streak_revival") && revival?.eligible && (
        <div className="card mb16 revival-card">
          <div className="section-title"><h4>💫 {t("revivalTitle")}</h4></div>
          <p className="small muted">{t("revivalHint").replace("{n}", revival.lostStreak)}</p>
          <div className="pbar sm mb8"><span style={{ width: `${Math.round((revival.lessonsDone / revival.lessonsRequired) * 100)}%` }} /></div>
          <div className="small muted mb8">{revival.lessonsDone}/{revival.lessonsRequired} {t("lessonsDone")}</div>
          {revival.ready
            ? <button className="btn btn-accent btn-block" disabled={busy === "revival"} onClick={claimRevival}>💫 {t("revivalClaim")}</button>
            : <span className="tag">{t("revivalDoLessons")}</span>}
        </div>
      )}

      {/* Daily goal ring + selector */}
      <div className="card mb16">
        <div className="q-goal">
          <div className="goal-ring" style={{ "--pct": `${goalPct * 3.6}deg` }}>
            <div className="gv"><b>{daily.today || 0}</b><div className="small muted">/ {daily.goal}</div></div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>{t("todayGoal")}</div>
            <div className="small muted mb8">{t("dailyGoalHint")}</div>
            <div className="goal-opts">
              {daily.options.map((o) => (
                <button key={o.value} className={`btn btn-sm ${daily.goal === o.value ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setGoal(o.value)}>{lang === "fa" ? o.fa : o.en} · {o.value}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Daily quests */}
      <div className="card mb16">
        <div className="section-title"><h4><Icon name="medal" size={18} /> {t("dailyQuests")}</h4></div>
        {quests.map((q) => {
          const pct = Math.min(100, Math.round((q.progress / q.goal) * 100));
          return (
            <div className={`quest-row ${q.done && !q.claimed ? "claimable" : ""} ${q.claimed ? "is-claimed" : ""}`} key={q.id}>
              <div className="quest-ico"><Icon name={q.icon} size={20} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{q.label} ({q.progress}/{q.goal})</div>
                <div className="pbar sm"><span style={{ width: `${pct}%` }} /></div>
              </div>
              <div className="quest-reward">
                {q.claimed ? <span className="tag done">✓</span>
                  : q.done ? <button className="btn btn-accent btn-sm" disabled={busy === "q" + q.id} onClick={() => claim(q.id)}>
                      <GemIcon size={14} /> +{q.reward_gems}</button>
                  : <span className="tag"><GemIcon size={14} /> {q.reward_gems}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Monthly Quest → collectible badge */}
      {flag("monthly_quest") && monthly?.enabled && (
        <div className="card mb16">
          <div className="section-title"><h4><Icon name="medal" size={18} /> {t("monthlyQuest")}</h4>
            <span className="tag">{monthly.progress}/{monthly.goal}</span></div>
          <div className="small muted mb8">{t("monthlyHint").replace("{n}", monthly.goal)}</div>
          <div className="pbar mb8"><span style={{ width: `${Math.min(100, Math.round((monthly.progress / monthly.goal) * 100))}%` }} /></div>
          {monthly.claimed
            ? <span className="tag done">✓ {t("claimed")}</span>
            : monthly.complete
              ? <button className="btn btn-accent btn-block" disabled={busy === "monthly"} onClick={claimMonthly}>🏅 {t("claimBadge")} · <GemIcon size={14} /> +{monthly.reward_gems}</button>
              : <span className="tag">🏅 {t("monthlyReward")}: <GemIcon size={14} /> +{monthly.reward_gems}</span>}
          {badges.length > 0 && (
            <div className="badge-shelf mt16">
              <div className="small muted mb8">{t("myBadges")}</div>
              <div className="badges-row">
                {badges.map((b) => (
                  <div key={b.badge_slug} className="badge-chip" title={lang === "fa" ? b.label_fa : b.label_en}>
                    <Icon name={b.icon || "medal"} size={20} />
                    <div className="small">{lang === "fa" ? b.label_fa : b.label_en}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Streak Wager — stake gems, commit to N days, double back */}
      {flag("streak_wager") && wager?.enabled && (
        <div className="card mb16 wager-card">
          <div className="section-title"><h4>🎲 {t("streakWager")}</h4></div>
          {wager.active ? (
            <>
              <div className="small muted mb8">{t("wagerActive").replace("{n}", wager.target_days)}</div>
              <div className="pbar mb8"><span style={{ width: `${Math.round((wager.days_done / wager.target_days) * 100)}%` }} /></div>
              <div className="small muted">{wager.days_done}/{wager.target_days} {t("days")} · {t("wagerReward")}: <GemIcon size={14} /> +{wager.reward}</div>
            </>
          ) : (
            <>
              <div className="small muted mb8">{t("wagerHint").replace("{d}", wager.target_days).replace("{s}", wager.stake).replace("{r}", wager.reward)}</div>
              <button className="btn btn-primary btn-block" disabled={busy === "wager"} onClick={placeWager}>
                🎲 {t("placeWager")} · <GemIcon size={14} /> {wager.stake}
              </button>
            </>
          )}
        </div>
      )}

      {/* Timed chests */}
      <div className="card mb16">
        <div className="section-title"><h4><Icon name="crown" size={18} /> {t("dailyChests")}</h4></div>
        <div className="small muted mb8">{t("chestsHint")}</div>
        <div className="chests">
          {chests.map((c) => (
            <div key={c.slug} className={`chest ${c.opened ? "opened" : c.available ? "ready" : "locked"}`}>
              <div className="chest-ico">{c.opened ? "✅" : c.available ? "🎁" : "🔒"}</div>
              <div style={{ fontWeight: 700 }}>{c.name}</div>
              <div className="small muted">{c.from}:00–{c.to}:00</div>
              {c.opened ? <span className="tag done">{t("opened")}</span>
                : c.available ? <button className="btn btn-accent btn-sm" disabled={busy === "c" + c.slug} onClick={() => openChest(c.slug)}>
                    <GemIcon size={14} /> +{c.gems}</button>
                : <span className="tag">{t("comeBack")}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Gem shop / powerups */}
      {shop && (
        <div className="card mb16">
          <div className="section-title"><h4><GemIcon size={14} /> {t("gemShop")}</h4>
            <span className="tag"><GemIcon size={14} /> {shop.gems} {t("gems")}</span></div>
          <div className="shop-grid">
            {shop.items.map((it) => (
              <div key={it.slug} className="shop-item">
                <div className="shop-ico"><Icon name={it.icon} size={22} /></div>
                <div style={{ fontWeight: 700 }}>{it.name}</div>
                <div className="small muted" style={{ flex: 1 }}>{it.desc}</div>
                <button className="btn btn-primary btn-sm btn-block" disabled={busy === "s" + it.slug || shop.gems < it.cost}
                  onClick={() => buy(it.slug)}><GemIcon size={14} /> {it.cost}</button>
              </div>
            ))}
          </div>
          {shop.xp_boost_until && new Date(shop.xp_boost_until) > new Date() &&
            <div className="micro-box small mt8" style={{ padding: "10px 14px" }}>⚡ {t("xpBoostActive")}</div>}
        </div>
      )}

      {/* Streak calendar + personal records */}
      {streak && (
        <div className="card">
          <div className="section-title"><h4><Icon name="clock" size={18} /> {t("streakCalendar")}</h4></div>
          <StreakGrid days={streak.days} />
          <div className="records mt16">
            {[["currentStreak", "clock", t("currentStreak")], ["bestStreak", "medal", t("bestStreak")],
              ["totalXp", "chart", t("totalXp")], ["bestDayXp", "bolt", t("bestDay")],
              ["totalLessons", "book", t("lessonsDone")], ["perfectLessons", "star", t("perfectLessons")]].map(([k, ic, label]) => (
              <div className="record" key={k}>
                <Icon name={ic} size={16} />
                <div><b>{streak.records[k] ?? 0}</b><div className="small muted">{label}</div></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Streak Society — tiered milestones with reward chests (Duolingo-style) */}
      {streak?.society && streak?.status && (
        <div className="card mt16">
          <div className="section-title"><h4><StreakIcon size={16} /> {t("streakSociety")}</h4>
            {streak.status.perfect > 0 && <span className="tag" title={t("perfectStreakNote")}><XpIcon size={13} /> {t("perfectStreak")}: {streak.status.perfect}</span>}
          </div>
          <div className="society-track">
            {streak.society.map((m) => {
              const reached = streak.status.streak >= m.days;
              const isNext = !reached && streak.status.nextMilestone === m.days;
              return (
                <div key={m.days} className={`society-tier ${reached ? "reached" : ""} ${isNext ? "next" : ""}`}>
                  <div className="st-days">{reached ? "✅" : isNext ? "🎁" : "🔒"} {m.days}</div>
                  <div className="small muted">+{m.gems} <GemIcon size={12} /> +{m.freezes} <Icon name="ampoule" size={12} /></div>
                </div>
              );
            })}
          </div>
          {streak.status.nextMilestone && (
            <div className="small muted mt8">🎯 {streak.status.toNext} {t("daysToMilestone")}</div>
          )}
        </div>
      )}
    </div>
  );
}

/* A 35-day calendar heat-strip. Active days show filled; days saved by a
   streak freeze show a distinct "frozen" style (Duolingo's blue snowflake). */
function StreakGrid({ days }) {
  // days is [{day, frozen}] (new shape) — tolerate the old string[] too.
  const map = new Map();
  for (const d of (days || [])) {
    if (typeof d === "string") map.set(d, false);
    else if (d && d.day) map.set(d.day, !!d.frozen);
  }
  const cells = [];
  for (let i = 34; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
    cells.push({ key, active: map.has(key), frozen: map.get(key) === true });
  }
  return (
    <div className="streak-grid">
      {cells.map((c) => <div key={c.key} className={`sc ${c.active ? (c.frozen ? "frozen" : "on") : ""}`} title={c.frozen ? c.key + " ❄️" : c.key}>{c.frozen ? "❄️" : ""}</div>)}
    </div>
  );
}
