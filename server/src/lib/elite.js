/* elite.js — Elite progression, Duolingo-style:
     • Legendary levels (crown 6): after MASTERING a lesson (5 stars), the learner
       can spend gems (free for premium) to attempt a harder, high-accuracy run;
       passing turns the node "legendary" (purple/gold crown), grants bonus XP,
       and the node "won't crack".
     • Diamond Tournament: an elite bracket layered on the weekly league for
       Diamond-tier learners — quarterfinal → semifinal → final, top N advance,
       finals podium earns gems + an XP boost + a Champion badge. */
import { db, persistNow } from "../db.js";
import { getProfile, awardXp, isoWeekKey, tehranDay } from "./gamify.js";
import { getGameConfig } from "./gameconfig.js";

/* ============================ LEGENDARY ============================ */

// Is a node eligible for a legendary attempt? (mastered = 5 stars, not yet legendary)
export function legendaryStatus(userId, nodeId) {
  const cfg = getGameConfig().legendary;
  const p = getProfile(userId);
  const pr = db.prepare("SELECT stars, legendary FROM node_progress WHERE user_id=? AND node_id=?").get(userId, nodeId);
  const mastered = (pr?.stars || 0) >= 5;
  return {
    enabled: cfg.enabled,
    mastered,
    isLegendary: !!pr?.legendary,
    eligible: cfg.enabled && mastered && !pr?.legendary,
    cost: p.premium_effective ? 0 : cfg.cost_gems,
    passRatio: cfg.pass_ratio,
    xpReward: cfg.xp_reward,
    premium: !!p.premium_effective,
    gems: p.gems,
  };
}

// Charge the gem cost and hand back the node's cards for a legendary run.
export function startLegendary(userId, nodeId) {
  const cfg = getGameConfig().legendary;
  if (!cfg.enabled) return { ok: false, error: "disabled" };
  const st = legendaryStatus(userId, nodeId);
  if (!st.mastered) return { ok: false, error: "not mastered" };
  if (st.isLegendary) return { ok: false, error: "already legendary" };
  const p = getProfile(userId);
  if (!p.premium_effective) {
    if (p.gems < cfg.cost_gems) return { ok: false, error: "not enough gems" };
    db.prepare("UPDATE learner_profiles SET gems=gems-? WHERE user_id=?").run(cfg.cost_gems, userId);
    persistNow();
  }
  return { ok: true };
}

// Finish a legendary run. Passing (>= pass_ratio) upgrades the node to legendary.
export function finishLegendary(userId, nodeId, correct, total) {
  const cfg = getGameConfig().legendary;
  if (!cfg.enabled) return { ok: false, error: "disabled" };
  // Same gate as startLegendary: the crown (and its bonus XP) can only be
  // claimed for a mastered node that is not already legendary. Without this a
  // direct POST to /finish farmed unlimited XP into the leaderboard.
  const st = legendaryStatus(userId, nodeId);
  if (!st.mastered) return { ok: false, error: "not mastered" };
  if (st.isLegendary) return { ok: false, error: "already legendary" };
  const t = Math.max(1, Number(total) || 1);
  const c = Math.min(t, Math.max(0, Number(correct) || 0));   // never > total
  const ratio = Math.round((c / t) * 100);
  const passed = ratio >= cfg.pass_ratio;
  if (!passed) return { ok: true, passed: false, ratio, needed: cfg.pass_ratio };
  // mark node legendary (crown 6) and bump the legendary counter
  db.prepare(`UPDATE node_progress SET legendary=1, legendary_at=datetime('now') WHERE user_id=? AND node_id=?`)
    .run(userId, nodeId);
  const count = db.prepare("SELECT COUNT(*) c FROM node_progress WHERE user_id=? AND legendary=1").get(userId).c;
  db.prepare("UPDATE learner_profiles SET legendary_count=? WHERE user_id=?").run(count, userId);
  // bonus XP through the normal engine (feeds leagues/streak too)
  const profile = awardXp(userId, cfg.xp_reward, "legendary", nodeId);
  persistNow();
  return { ok: true, passed: true, ratio, xp: cfg.xp_reward, legendaryCount: count, profile };
}

export function legendaryCount(userId) {
  return db.prepare("SELECT COUNT(*) c FROM node_progress WHERE user_id=? AND legendary=1").get(userId).c;
}

/* ============================ DIAMOND TOURNAMENT ============================ */

const STAGES = ["quarterfinal", "semifinal", "final"];
export const STAGE_LABEL = {
  quarterfinal: { fa: "یک‌چهارم نهایی", en: "Quarterfinal" },
  semifinal: { fa: "نیمه‌نهایی", en: "Semifinal" },
  final: { fa: "فینال", en: "Final" },
};

// A learner is in the tournament this week if they're diamond tier and a
// tournament room exists for them. We derive the "stage" from a rotating
// schedule keyed to the ISO week so the demo always shows a live stage.
function stageForWeek(wk) {
  // deterministic 3-week rotation from the week number
  const n = parseInt((wk.split("-W")[1] || "1"), 10);
  return STAGES[(n - 1) % 3];
}

// Ensure the current diamond learner is placed into a tournament room for this
// week. Returns the league_id (a room tagged with `tournament=stage`).
export function ensureTournament(userId) {
  const cfg = getGameConfig().tournament;
  if (!cfg.enabled) return null;
  const p = getProfile(userId);
  if (p.tier !== "diamond") return null;
  const wk = isoWeekKey();
  const stage = stageForWeek(wk);
  const existing = db.prepare(`
    SELECT lm.league_id FROM league_members lm JOIN leagues l ON l.id=lm.league_id
    WHERE lm.user_id=? AND l.week_key=? AND l.tournament IS NOT NULL`).get(userId, wk);
  if (existing) return existing.league_id;
  // find a tournament room with capacity (15 per Duolingo), else create one
  let room = db.prepare(`
    SELECT l.id, COUNT(lm.id) n FROM leagues l LEFT JOIN league_members lm ON lm.league_id=l.id
    WHERE l.week_key=? AND l.tier='diamond' AND l.tournament=?
    GROUP BY l.id HAVING n < 15 ORDER BY l.room LIMIT 1`).get(wk, stage);
  let leagueId;
  if (room) leagueId = room.id;
  else {
    const maxRoom = db.prepare("SELECT MAX(room) m FROM leagues WHERE week_key=? AND tier='diamond' AND tournament=?").get(wk, stage)?.m || 100;
    const r = db.prepare("INSERT INTO leagues (week_key, tier, room, tournament) VALUES (?, 'diamond', ?, ?)").run(wk, maxRoom + 1, stage);
    leagueId = r.lastInsertRowid;
  }
  db.prepare("INSERT OR IGNORE INTO league_members (league_id, user_id, xp) VALUES (?,?,?)").run(leagueId, userId, p.weekly_xp);
  persistNow();
  return leagueId;
}

export function tournamentStandings(userId, lang = "fa") {
  const cfg = getGameConfig().tournament;
  if (!cfg.enabled) return { enabled: false };
  const p = getProfile(userId);
  if (p.tier !== "diamond") return { enabled: true, qualified: false };
  const leagueId = ensureTournament(userId);
  if (!leagueId) return { enabled: true, qualified: false };
  const league = db.prepare("SELECT * FROM leagues WHERE id=?").get(leagueId);
  const stage = league.tournament;
  const rows = db.prepare(`
    SELECT lm.user_id, lm.xp, u.name_fa, u.name_en, lp.streak, lp.tournament_wins
    FROM league_members lm JOIN users u ON u.id=lm.user_id
    LEFT JOIN learner_profiles lp ON lp.user_id=lm.user_id
    WHERE lm.league_id=? ORDER BY lm.xp DESC, lm.id ASC`).all(leagueId);
  const isFinal = stage === "final";
  const members = rows.map((r, i) => ({
    rank: i + 1, user_id: r.user_id, xp: r.xp, streak: r.streak || 0,
    name: lang === "fa" ? (r.name_fa || r.name_en) : (r.name_en || r.name_fa),
    wins: r.tournament_wins || 0,
    // in non-final stages the top `advance` progress; in finals top `advance` are champions
    zone: i < cfg.advance ? (isFinal ? "champion" : "advance") : "out",
  }));
  return {
    enabled: true, qualified: true, stage,
    stageLabel: STAGE_LABEL[stage] ? STAGE_LABEL[stage][lang === "fa" ? "fa" : "en"] : stage,
    advance: cfg.advance, isFinal, me: userId, members,
    podiumGems: cfg.podium_gems,
  };
}

// Settle the finals (called on demand / by a cron-like trigger): pay podium gems,
// grant an XP boost to finalists, record champions + badge. Idempotent per week.
export function settleTournamentFinals(leagueId) {
  const cfg = getGameConfig().tournament;
  const league = db.prepare("SELECT * FROM leagues WHERE id=?").get(leagueId);
  if (!league || league.tournament !== "final") return { ok: false };
  const rows = db.prepare("SELECT user_id, xp FROM league_members WHERE league_id=? ORDER BY xp DESC, id ASC").all(leagueId);
  const winners = [];
  rows.forEach((r, i) => {
    if (i >= cfg.advance) return;
    const already = db.prepare("SELECT 1 FROM tournament_champions WHERE user_id=? AND week_key=?").get(r.user_id, league.week_key);
    if (already) return;
    const gems = cfg.podium_gems[i] || 0;
    db.prepare("INSERT OR IGNORE INTO tournament_champions (user_id, week_key, rank, gems) VALUES (?,?,?,?)")
      .run(r.user_id, league.week_key, i + 1, gems);
    if (gems) db.prepare("UPDATE learner_profiles SET gems=gems+? WHERE user_id=?").run(gems, r.user_id);
    // XP boost for all finalists
    const until = new Date(Date.now() + cfg.boost_minutes * 60000).toISOString();
    db.prepare("UPDATE learner_profiles SET xp_boost_until=?, tournament_wins=tournament_wins+1 WHERE user_id=?").run(until, r.user_id);
    winners.push({ user_id: r.user_id, rank: i + 1, gems });
  });
  persistNow();
  return { ok: true, winners };
}

export function championBadges(userId, lang = "fa") {
  return db.prepare("SELECT week_key, rank, gems, created_at FROM tournament_champions WHERE user_id=? ORDER BY id DESC").all(userId);
}
