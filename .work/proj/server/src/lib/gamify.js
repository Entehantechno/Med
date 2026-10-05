/* Gamification engine for the pre-internship learner track.
   Implements XP, daily streaks (+ freeze), hearts/energy, weekly leagues with
   promotion/relegation, tiers, and achievement checks.
   Design informed by Duolingo's mechanics: XP is the shared currency that feeds
   streaks, leagues and achievements simultaneously. */
import { db, persistNow } from "../db.js";
import { isEnabled } from "./flags.js";
import { getGameConfig } from "./gameconfig.js";

/* Is the Premium PROGRAM switched on at all? When the admin turns the `premium`
   feature flag OFF, we want ZERO trace of premium for users: no upsell, no
   locked content, no ads, no hearts limit. So while it's off, everyone is
   treated as "effectively premium" for ACCESS purposes (unlimited hearts, no
   ads, no premium gates) WITHOUT touching their real DB premium flag — so when
   the admin later switches it on, genuine paid status is preserved. */
export function premiumProgramOn() {
  return isEnabled("premium");
}

export const TIERS = ["bronze", "silver", "gold", "sapphire", "ruby", "diamond"];
export const TIER_LABEL = {
  bronze:  { fa: "برنز",   en: "Bronze" },
  silver:  { fa: "نقره",   en: "Silver" },
  gold:    { fa: "طلا",    en: "Gold" },
  sapphire:{ fa: "یاقوت کبود", en: "Sapphire" },
  ruby:    { fa: "یاقوت سرخ",  en: "Ruby" },
  diamond: { fa: "الماس",  en: "Diamond" },
};
/* Hearts are admin-tunable (Admin → گیمیفیکیشن → قلب‌ها). Defaults: 30 hearts,
   one back every 30 minutes. Read live so a change applies without restart. */
export function maxHearts() {
  const v = Number(getGameConfig()?.hearts?.max);
  return Number.isFinite(v) && v >= 1 ? Math.min(999, Math.floor(v)) : 30;
}
export function heartRefillMinutes() {
  const v = Number(getGameConfig()?.hearts?.refill_minutes);
  return Number.isFinite(v) && v >= 1 ? Math.min(24 * 60, Math.floor(v)) : 30;
}
export function heartRefillGems() {
  const v = Number(getGameConfig()?.hearts?.refill_gems);
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 50;
}

export const ROOM_SIZE = 30;            // learners per league room
export const PROMOTE = 7;               // top N promote
export const RELEGATE = 5;              // bottom N relegate (except bronze)

/* ---------- date helpers (Tehran) ---------- */
export function tehranDay(d = new Date()) {
  // YYYY-MM-DD in Asia/Tehran
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return parts; // en-CA gives YYYY-MM-DD
}
export function isoWeekKey(d = new Date()) {
  // ISO week from the Tehran calendar date (same clock as tehranDay / streaks).
  const [y, m, dd] = tehranDay(d).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, dd));
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((dt - yearStart) / 86400000) + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Stack N premium days. Lifetime (premium=1, no until) is never downgraded. */
export function stackPremiumUntil(p, days, now = Date.now()) {
  if (p?.premium && !p.premium_until) return null;
  const extra = Math.max(1, Number(days) || 1) * 86400000;
  const parsed = p?.premium_until ? new Date(p.premium_until).getTime() : NaN;
  const currentEnd = p?.premium && Number.isFinite(parsed) ? Math.max(now, parsed) : now;
  return new Date(currentEnd + extra).toISOString();
}
function daysBetween(a, b) {
  const da = new Date(a + "T00:00:00Z"), db_ = new Date(b + "T00:00:00Z");
  return Math.round((db_ - da) / 86400000);
}
function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/* ---------- profile ---------- */
export function getProfile(userId) {
  let p = db.prepare("SELECT * FROM learner_profiles WHERE user_id = ?").get(userId);
  if (!p) {
    db.prepare("INSERT INTO learner_profiles (user_id, week_key, hearts, hearts_updated) VALUES (?,?,?,?)")
      .run(userId, isoWeekKey(), maxHearts(), new Date().toISOString());
    p = db.prepare("SELECT * FROM learner_profiles WHERE user_id = ?").get(userId);
  }
  return refreshDerived(p);
}

// recompute hearts (time-based refill) and reset weekly XP on new week
function refreshDerived(p) {
  let changed = false;
  // Honour premium_until so a 30-day grant cannot vanish overnight, and so an
  // expired grant is actually turned off (the flag alone used to stay 1 forever
  // OR get wiped by an XP-adjust that forgot the expiry).
  if (p.premium && p.premium_until) {
    const untilMs = new Date(p.premium_until).getTime();
    if (Number.isFinite(untilMs) && untilMs <= Date.now()) {
      p.premium = 0;
      p.premium_until = null;
      db.prepare("UPDATE learner_profiles SET premium=0, premium_until=NULL WHERE user_id=?")
        .run(p.user_id);
      persistNow();
    }
  } else if (!p.premium && p.premium_until) {
    const untilMs = new Date(p.premium_until).getTime();
    if (Number.isFinite(untilMs) && untilMs > Date.now()) {
      p.premium = 1;
      db.prepare("UPDATE learner_profiles SET premium=1 WHERE user_id=?").run(p.user_id);
      persistNow();
    }
  }
  // "Effective premium": real premium OR the premium program is switched off
  // (so users never hit premium walls while premium is disabled).
  const progOff = !premiumProgramOn();
  const eff = !!p.premium || progOff;
  // hearts refill
  const MAXH = maxHearts(), REFILL = heartRefillMinutes();
  if (!eff && p.hearts < MAXH) {
    const last = p.hearts_updated ? new Date(p.hearts_updated) : new Date();
    const mins = Math.floor((Date.now() - last.getTime()) / 60000);
    const gain = Math.floor(mins / REFILL);
    if (gain > 0) {
      p.hearts = Math.min(MAXH, p.hearts + gain);
      p.hearts_updated = new Date(last.getTime() + gain * REFILL * 60000).toISOString();
      changed = true;
    }
  }
  // Admin raised the cap (e.g. 5 → 30): a bar that was "full" under the old
  // cap is silently topped up so nobody is stuck below the new maximum.
  if (!eff && p.hearts < MAXH && !p.hearts_updated) { p.hearts = MAXH; changed = true; }
  if (eff) p.hearts = MAXH;
  p.hearts_max = MAXH;
  p.heart_refill_minutes = REFILL;
  p.heart_refill_gems = heartRefillGems();
  if (!eff && p.hearts < MAXH && p.hearts_updated) {
    const nextMs = new Date(p.hearts_updated).getTime() + REFILL * 60000;
    p.next_heart_in_s = Math.max(0, Math.round((nextMs - Date.now()) / 1000));
  } else p.next_heart_in_s = 0;
  // expose the computed access flag (NOT persisted; real p.premium is untouched)
  p.premium_effective = eff;
  p.premium_program_on = !progOff;
  // Entitlements the client uses to unlock bank / summaries / library / hearts.
  // When the premium PROGRAM is off, everyone is treated as unlocked.
  p.entitlements = {
    bankFull: eff || !isEnabled("full_bank"),
    summaries: eff || isEnabled("summaries_free"),
    library: eff,
    heartsUnlimited: eff,
    noAds: eff,
    lifetime: !!(p.premium && !p.premium_until),
  };
  // weekly reset
  const wk = isoWeekKey();
  if (p.week_key !== wk) { p.week_key = wk; p.weekly_xp = 0; changed = true; }
  if (changed) {
    db.prepare("UPDATE learner_profiles SET hearts=?, hearts_updated=?, week_key=?, weekly_xp=? WHERE user_id=?")
      .run(p.hearts, p.hearts_updated, p.week_key, p.weekly_xp, p.user_id);
    persistNow();
  }
  return p;
}

/* ---------- XP / streak ---------- */
export function awardXp(userId, amount, reason = "lesson", nodeId = null) {
  const p = getProfile(userId);
  const today = tehranDay();
  // Active XP Boost powerup doubles earned XP (Duolingo-style variable reward).
  if (p.xp_boost_until && new Date(p.xp_boost_until) > new Date()) amount = amount * 2;
  db.prepare("INSERT INTO xp_events (user_id, amount, reason, node_id, day) VALUES (?,?,?,?,?)")
    .run(userId, amount, reason, nodeId, today);
  // Log the active day for the streak calendar (not frozen — user was active).
  db.prepare("INSERT OR IGNORE INTO streak_days (user_id, day, frozen) VALUES (?,?,0)").run(userId, today);
  db.prepare("UPDATE streak_days SET frozen=0 WHERE user_id=? AND day=?").run(userId, today);
  // ---- streak update (Duolingo-style, with freeze insurance + perfect streak) ----
  let streak = p.streak, freezes = p.freezes, perfect = p.perfect_streak || 0;
  let usedFreeze = false, streakIncremented = false;
  if (p.last_active) {
    const gap = daysBetween(p.last_active, today);
    const missedDays = gap - 1;   // full days skipped between last active day and today
    if (gap === 0) { /* same day, keep everything */ }
    else if (gap === 1) { streak += 1; perfect += 1; streakIncremented = true; } // clean day
    else if (missedDays >= 1 && freezes >= missedDays) {
      // Every missed day is covered by ONE freeze each (Duolingo stacks up to a
      // few). The streak keeps growing but the PERFECT streak resets (a freeze
      // was used). Each covered day is marked frozen (❄️/💉) in the calendar.
      for (let i = 1; i <= missedDays; i++) {
        const d = addDays(today, -i);
        db.prepare("INSERT OR IGNORE INTO streak_days (user_id, day, frozen) VALUES (?,?,1)").run(userId, d);
        db.prepare("UPDATE streak_days SET frozen=1 WHERE user_id=? AND day=?").run(userId, d);
      }
      freezes -= missedDays; streak += 1; perfect = 0; usedFreeze = true; streakIncremented = true;
    } else { streak = 1; perfect = 1; streakIncremented = true; } // broke — restart
  } else { streak = 1; perfect = 1; streakIncremented = true; }
  const best = Math.max(p.best_streak, streak);
  const newXp = p.xp + amount;
  const newWeekly = p.weekly_xp + amount;
  const tier = tierForXp(newXp);
  // Detect a tier promotion (a real "level up") so the client can celebrate it
  // with a dedicated fanfare + confetti. Only fire when the tier index rose.
  const prevTierIdx = TIERS.indexOf(p.tier || "bronze");
  const newTierIdx = TIERS.indexOf(tier);
  const tierUp = newTierIdx > prevTierIdx ? { from: p.tier || "bronze", to: tier } : null;
  db.prepare(`UPDATE learner_profiles SET xp=?, weekly_xp=?, streak=?, best_streak=?, last_active=?, freezes=?, perfect_streak=?, tier=? WHERE user_id=?`)
    .run(newXp, newWeekly, streak, best, today, freezes, perfect, tier, userId);
  // reflect into current league membership
  syncLeagueXp(userId, newWeekly);
  // ---- Streak Society: reward milestones as they're crossed (auto-grant) ----
  const milestone = checkStreakSociety(userId, streak, p.society_tier || 0);
  persistNow();
  const out = getProfile(userId);
  return { ...out, _streak: { incremented: streakIncremented, usedFreeze, milestone }, _tierUp: tierUp };
}

// Streak Society tiers (days). Crossing a tier grants a chest of real value:
// freezes (so the freeze is "already in the pocket") + gems, Duolingo-style.
export const STREAK_SOCIETY = [
  { days: 3, gems: 20, freezes: 1 },
  { days: 7, gems: 40, freezes: 1 },
  { days: 14, gems: 60, freezes: 1 },
  { days: 30, gems: 120, freezes: 2 },
  { days: 60, gems: 200, freezes: 2 },
  { days: 100, gems: 400, freezes: 3 },
  { days: 180, gems: 700, freezes: 3 },
  { days: 365, gems: 1500, freezes: 3 },
];
export function checkStreakSociety(userId, streak, currentTier) {
  // Grant EVERY crossed milestone (a 0→7 jump still pays the day-3 chest).
  const due = STREAK_SOCIETY.filter((m) => streak >= m.days && m.days > (currentTier || 0));
  if (!due.length) return null;
  let gems = 0, freezesAdd = 0, reached = currentTier || 0;
  for (const m of due) { gems += m.gems; freezesAdd += m.freezes; reached = m.days; }
  const p = db.prepare("SELECT gems, freezes FROM learner_profiles WHERE user_id=?").get(userId);
  const newFreezes = Math.min(5, (p.freezes || 0) + freezesAdd);
  db.prepare("UPDATE learner_profiles SET gems=gems+?, freezes=?, society_tier=? WHERE user_id=?")
    .run(gems, newFreezes, reached, userId);
  return { days: reached, gems, freezes: freezesAdd, stacked: due.length };
}

export function tierForXp(xp) {
  if (xp >= 12000) return "diamond";
  if (xp >= 6000) return "ruby";
  if (xp >= 3000) return "sapphire";
  if (xp >= 1200) return "gold";
  if (xp >= 400) return "silver";
  return "bronze";
}

/* ---------- hearts ---------- */
export function loseHeart(userId) {
  const p = getProfile(userId);
  if (p.premium_effective) return p;   // no heart loss for premium OR when program off
  const h = Math.max(0, p.hearts - 1);
  // Start the refill clock only when leaving a full bar; otherwise keep the
  // existing tick so a second miss does not rewind the 30-minute timer.
  const ts = p.hearts >= maxHearts()
    ? new Date().toISOString()
    : (p.hearts_updated || new Date().toISOString());
  db.prepare("UPDATE learner_profiles SET hearts=?, hearts_updated=? WHERE user_id=?")
    .run(h, ts, userId);
  persistNow();
  return getProfile(userId);
}
export function refillHearts(userId, cost = 0) {
  const p = getProfile(userId);
  db.prepare("UPDATE learner_profiles SET hearts=?, hearts_updated=?, gems=? WHERE user_id=?")
    .run(maxHearts(), new Date().toISOString(), Math.max(0, p.gems - cost), userId);
  persistNow();
  return getProfile(userId);
}

/* ---------- leagues ---------- */
export function ensureLeague(userId) {
  const p = getProfile(userId);
  const wk = isoWeekKey();
  // already a member this week?
  const existing = db.prepare(`
    SELECT lm.* FROM league_members lm JOIN leagues l ON l.id = lm.league_id
    WHERE lm.user_id = ? AND l.week_key = ?`).get(userId, wk);
  if (existing) return existing.league_id;
  // find a room in the learner's tier with capacity, else create one
  const tier = p.tier;
  let room = db.prepare(`
    SELECT l.id, COUNT(lm.id) AS n FROM leagues l
    LEFT JOIN league_members lm ON lm.league_id = l.id
    WHERE l.week_key = ? AND l.tier = ?
    GROUP BY l.id HAVING n < ? ORDER BY l.room LIMIT 1`).get(wk, tier, ROOM_SIZE);
  let leagueId;
  if (room) { leagueId = room.id; }
  else {
    const maxRoom = db.prepare("SELECT MAX(room) AS m FROM leagues WHERE week_key=? AND tier=?").get(wk, tier)?.m || 0;
    const r = db.prepare("INSERT INTO leagues (week_key, tier, room) VALUES (?,?,?)").run(wk, tier, maxRoom + 1);
    leagueId = r.lastInsertRowid;
  }
  db.prepare("INSERT OR IGNORE INTO league_members (league_id, user_id, xp) VALUES (?,?,?)")
    .run(leagueId, userId, p.weekly_xp);
  persistNow();
  return leagueId;
}
function syncLeagueXp(userId, weeklyXp) {
  const wk = isoWeekKey();
  const m = db.prepare(`
    SELECT lm.id FROM league_members lm JOIN leagues l ON l.id = lm.league_id
    WHERE lm.user_id = ? AND l.week_key = ?`).get(userId, wk);
  if (m) db.prepare("UPDATE league_members SET xp=? WHERE id=?").run(weeklyXp, m.id);
}
export function getLeague(userId, lang = "fa") {
  const leagueId = ensureLeague(userId);
  const league = db.prepare("SELECT * FROM leagues WHERE id=?").get(leagueId);
  const rows = db.prepare(`
    SELECT lm.user_id, lm.xp, u.name_fa, u.name_en, lp.province, lp.streak, lp.tier, lp.anon_mode, lp.alias
    FROM league_members lm
    JOIN users u ON u.id = lm.user_id
    LEFT JOIN learner_profiles lp ON lp.user_id = lm.user_id
    WHERE lm.league_id = ? ORDER BY lm.xp DESC, lm.id ASC`).all(leagueId);
  const ranked = rows.map((r, i) => ({
    rank: i + 1, user_id: r.user_id, xp: r.xp, streak: r.streak || 0, tier: r.tier || "bronze",
    name: rankDisplayName(r, userId, lang), anon: !!r.anon_mode && r.user_id !== userId,
    province: r.province || "",
    zone: i < PROMOTE ? "promote" : (i >= rows.length - RELEGATE && league.tier !== "bronze" ? "relegate" : "stay"),
  }));
  return { league, tier: league.tier, promote: PROMOTE, relegate: RELEGATE, me: userId, members: ranked };
}

/* Country / province ranking (all-time XP) */
/* ---------- Anonymous / stealth ranking (opt-in privacy) ----------
   A learner who turns on stealth mode appears under a pseudonym to EVERYONE
   ELSE, but always sees their own real name (so they can find themselves).
   Research: pseudonyms protect self-esteem for lower-ranked learners and cut
   the anxiety of public comparison while keeping the motivation to compete. */
function aliasFor(row, lang) {
  if (row.alias && String(row.alias).trim()) return String(row.alias).trim();
  // deterministic fallback from the admin alias pool (stable per user)
  const cfg = getGameConfig().anon || {};
  const pool = (lang === "fa" ? cfg.alias_pool_fa : cfg.alias_pool_en) || [];
  if (!pool.length) return lang === "fa" ? "ناشناس" : "Anonymous";
  return pool[(row.id || row.user_id || 0) % pool.length];
}
// Resolve the name to show for `row` when viewed by `viewerId`.
export function rankDisplayName(row, viewerId, lang = "fa") {
  const real = lang === "fa" ? (row.name_fa || row.name_en) : (row.name_en || row.name_fa);
  const isMe = (row.id || row.user_id) === viewerId;
  const anon = !isMe && isEnabled("anon_ranking") && (row.anon_mode === 1 || row.anon_mode === true);
  return anon ? aliasFor(row, lang) : real;
}

/* Read a learner's stealth-ranking settings (merged with admin alias pool). */
export function getAnonSettings(userId, lang = "fa") {
  const p = db.prepare("SELECT anon_mode, alias FROM learner_profiles WHERE user_id=?").get(userId) || {};
  const cfg = getGameConfig().anon || {};
  return {
    enabled: !!p.anon_mode,
    alias: p.alias || "",
    // a preview of the alias the learner would show under (their chosen one, or
    // the deterministic pool fallback) so the UI can display it before saving.
    aliasPreview: aliasFor({ id: userId, alias: p.alias }, lang),
    featureEnabled: cfg.enabled !== false,
    maxAliasLen: 24,
  };
}

/* Update a learner's stealth-ranking settings. A blank alias falls back to the
   deterministic pool alias. */
export function setAnonSettings(userId, patch = {}, lang = "fa") {
  const sets = [], vals = [];
  if ("enabled" in patch) { sets.push("anon_mode=?"); vals.push(patch.enabled ? 1 : 0); }
  if ("alias" in patch) {
    const a = String(patch.alias || "").replace(/[<>]/g, "").trim().slice(0, 24);
    sets.push("alias=?"); vals.push(a || null);
  }
  if (sets.length) {
    vals.push(userId);
    db.prepare(`UPDATE learner_profiles SET ${sets.join(", ")} WHERE user_id=?`).run(...vals);
    persistNow();
  }
  return getAnonSettings(userId, lang);
}

export function countryRanking(userId, lang = "fa", limit = 100) {
  const rows = db.prepare(`
    SELECT u.id, u.name_fa, u.name_en, lp.xp, lp.streak, lp.tier, lp.province, lp.anon_mode, lp.alias
    FROM learner_profiles lp JOIN users u ON u.id = lp.user_id
    WHERE u.role='learner' AND u.status='active'
    ORDER BY lp.xp DESC, u.id ASC LIMIT ?`).all(limit);
  const list = rows.map((r, i) => ({
    rank: i + 1, user_id: r.id, xp: r.xp, streak: r.streak, tier: r.tier, province: r.province || "",
    name: rankDisplayName(r, userId, lang), anon: !!r.anon_mode && r.id !== userId,
  }));
  const meRow = db.prepare(`
    SELECT COUNT(*)+1 AS rank FROM learner_profiles lp JOIN users u ON u.id=lp.user_id
    WHERE u.role='learner' AND u.status='active' AND lp.xp > (SELECT xp FROM learner_profiles WHERE user_id=?)`).get(userId);
  const total = db.prepare(`
    SELECT COUNT(*) AS n FROM learner_profiles lp JOIN users u ON u.id=lp.user_id
    WHERE u.role='learner' AND u.status='active'`).get()?.n || list.length;
  return { list, myRank: meRow?.rank || null, total, me: userId };
}

/* Province ranking: rank learners within the current user's own province. */
export function provinceRanking(userId, lang = "fa", limit = 100) {
  const me = db.prepare("SELECT province FROM learner_profiles WHERE user_id=?").get(userId);
  const province = me?.province || "";
  if (!province) return { province: "", list: [], myRank: null };
  const rows = db.prepare(`
    SELECT u.id, u.name_fa, u.name_en, lp.xp, lp.streak, lp.tier, lp.province, lp.anon_mode, lp.alias
    FROM learner_profiles lp JOIN users u ON u.id = lp.user_id
    WHERE u.role='learner' AND u.status='active' AND lp.province=?
    ORDER BY lp.xp DESC, u.id ASC LIMIT ?`).all(province, limit);
  const list = rows.map((r, i) => ({
    rank: i + 1, user_id: r.id, xp: r.xp, streak: r.streak, tier: r.tier, province: r.province || "",
    name: rankDisplayName(r, userId, lang), anon: !!r.anon_mode && r.id !== userId,
  }));
  const meRow = db.prepare(`
    SELECT COUNT(*)+1 AS rank FROM learner_profiles lp JOIN users u ON u.id=lp.user_id
    WHERE u.role='learner' AND u.status='active' AND lp.province=? AND lp.xp > (SELECT xp FROM learner_profiles WHERE user_id=?)`).get(province, userId);
  const total = db.prepare(`
    SELECT COUNT(*) AS n FROM learner_profiles lp JOIN users u ON u.id=lp.user_id
    WHERE u.role='learner' AND u.status='active' AND lp.province=?`).get(province)?.n || list.length;
  return { province, list, myRank: meRow?.rank || null, total, me: userId };
}

/* ---------- achievements ---------- */
export function checkAchievements(userId) {
  const p = getProfile(userId);
  const nodes = db.prepare("SELECT COUNT(*) AS c FROM node_progress WHERE user_id=? AND completed_at IS NOT NULL").get(userId).c;
  const perfect = db.prepare("SELECT COUNT(*) AS c FROM node_progress WHERE user_id=? AND stars>=5").get(userId).c;
  const legend = db.prepare("SELECT COUNT(*) AS c FROM node_progress WHERE user_id=? AND legendary=1").get(userId).c;
  const champion = db.prepare("SELECT COUNT(*) AS c FROM tournament_champions WHERE user_id=?").get(userId).c;
  const metrics = { streak: p.streak, xp: p.xp, nodes, perfect, legend, champion, league: p.tier === "diamond" ? 1 : 0 };
  const achs = db.prepare("SELECT * FROM achievements").all();
  const newly = [];
  for (const a of achs) {
    const val = metrics[a.metric] ?? 0;
    let ua = db.prepare("SELECT * FROM user_achievements WHERE user_id=? AND achievement_id=?").get(userId, a.id);
    if (!ua) {
      db.prepare("INSERT INTO user_achievements (user_id, achievement_id, progress) VALUES (?,?,?)").run(userId, a.id, val);
      ua = db.prepare("SELECT * FROM user_achievements WHERE user_id=? AND achievement_id=?").get(userId, a.id);
    } else {
      db.prepare("UPDATE user_achievements SET progress=? WHERE id=?").run(val, ua.id);
    }
    if (!ua.unlocked_at && val >= a.threshold) {
      db.prepare("UPDATE user_achievements SET unlocked_at=datetime('now'), progress=? WHERE id=?").run(val, ua.id);
      newly.push(a);
    }
  }
  persistNow();
  return newly;
}
