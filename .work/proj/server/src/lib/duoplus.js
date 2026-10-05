/* duoplus.js — Duolingo-2026 retention mechanics layered on the existing engine:
     • Streak Wager  — stake gems, commit to N streak days, double back on success
     • Monthly Quest — complete N daily quests in a month → collectible badge
     • XP Ramp-Up    — timed blitz event that pays bonus XP
     • Streak Revival— free comeback for lapsed high-streak learners
   All knobs come from gameconfig.js (admin-editable). Days use Tehran time. */
import { db, persistNow } from "../db.js";
import { getProfile, tehranDay, awardXp } from "./gamify.js";
import { getGameConfig } from "./gameconfig.js";

/* ---------- date helpers ---------- */
export function tehranMonth(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit" }).format(d); // YYYY-MM
}
function daysBetween(a, b) {
  return Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 86400000);
}

/* ===================================================================
   1) STREAK WAGER
   =================================================================== */
export function wagerStatus(userId) {
  const cfg = getGameConfig().wager;
  const active = db.prepare("SELECT * FROM streak_wagers WHERE user_id=? AND status='active' ORDER BY id DESC LIMIT 1").get(userId);
  const p = getProfile(userId);
  if (active) {
    const daysDone = Math.max(0, (p.streak || 0) - active.start_streak);
    return {
      enabled: cfg.enabled, active: true,
      stake: active.stake, reward: active.reward,
      target_days: active.target_days,
      days_done: Math.min(daysDone, active.target_days),
      start_day: active.start_day,
    };
  }
  return { enabled: cfg.enabled, active: false, stake: cfg.stake, reward: cfg.reward, target_days: cfg.target_days };
}

export function placeWager(userId) {
  const cfg = getGameConfig().wager;
  if (!cfg.enabled) return { ok: false, error: "disabled" };
  const existing = db.prepare("SELECT id FROM streak_wagers WHERE user_id=? AND status='active'").get(userId);
  if (existing) return { ok: false, error: "already active" };
  const p = getProfile(userId);
  if (p.gems < cfg.stake) return { ok: false, error: "not enough gems" };
  db.prepare("UPDATE learner_profiles SET gems=gems-? WHERE user_id=?").run(cfg.stake, userId);
  db.prepare(`INSERT INTO streak_wagers (user_id, start_day, start_streak, target_days, stake, reward, status)
              VALUES (?,?,?,?,?,?, 'active')`)
    .run(userId, tehranDay(), p.streak || 0, cfg.target_days, cfg.stake, cfg.reward);
  persistNow();
  return { ok: true, wager: wagerStatus(userId), profile: getProfile(userId) };
}

// Called after a lesson finishes (streak already updated). Settles win/loss.
export function settleWagers(userId) {
  const w = db.prepare("SELECT * FROM streak_wagers WHERE user_id=? AND status='active' ORDER BY id DESC LIMIT 1").get(userId);
  if (!w) return null;
  const p = getProfile(userId);
  const today = tehranDay();
  const daysDone = (p.streak || 0) - w.start_streak;
  // WIN: reached target streak days
  if (daysDone >= w.target_days && (p.streak || 0) > w.start_streak) {
    db.prepare("UPDATE streak_wagers SET status='won', settled_at=datetime('now') WHERE id=?").run(w.id);
    db.prepare("UPDATE learner_profiles SET gems=gems+? WHERE user_id=?").run(w.reward, userId);
    persistNow();
    return { result: "won", reward: w.reward };
  }
  // LOSE: streak was broken (dropped at or below where it started) after the wager
  const brokeGap = p.last_active ? daysBetween(p.last_active, today) : 99;
  if ((p.streak || 0) <= w.start_streak && brokeGap >= 1 && w.start_day !== today) {
    // Streak reset since wager: it fell back to (or below) the starting count.
    if ((p.streak || 0) < w.start_streak) {
      db.prepare("UPDATE streak_wagers SET status='lost', settled_at=datetime('now') WHERE id=?").run(w.id);
      persistNow();
      return { result: "lost" };
    }
  }
  return null;
}

/* ===================================================================
   2) MONTHLY QUEST → collectible BADGE
   =================================================================== */
function ensureMonthly(userId) {
  const cfg = getGameConfig().monthly;
  const month = tehranMonth();
  let row = db.prepare("SELECT * FROM monthly_quests WHERE user_id=? AND month=?").get(userId, month);
  if (!row) {
    db.prepare("INSERT OR IGNORE INTO monthly_quests (user_id, month, progress, goal, badge_slug) VALUES (?,?,0,?,?)")
      .run(userId, month, cfg.goal, `month:${month}`);
    row = db.prepare("SELECT * FROM monthly_quests WHERE user_id=? AND month=?").get(userId, month);
  }
  return row;
}
export function monthlyStatus(userId) {
  const cfg = getGameConfig().monthly;
  const row = ensureMonthly(userId);
  return {
    enabled: cfg.enabled, month: row.month,
    progress: row.progress, goal: row.goal,
    reward_gems: cfg.reward_gems, claimed: !!row.claimed,
    complete: row.progress >= row.goal,
  };
}
// Called whenever a daily quest is claimed → +1 monthly progress.
export function bumpMonthly(userId) {
  const row = ensureMonthly(userId);
  if (row.progress < row.goal) {
    db.prepare("UPDATE monthly_quests SET progress=progress+1 WHERE id=?").run(row.id);
    persistNow();
  }
}
export function claimMonthly(userId) {
  const cfg = getGameConfig().monthly;
  const row = ensureMonthly(userId);
  if (row.claimed || row.progress < row.goal) return { ok: false };
  db.prepare("UPDATE monthly_quests SET claimed=1 WHERE id=?").run(row.id);
  db.prepare("UPDATE learner_profiles SET gems=gems+? WHERE user_id=?").run(cfg.reward_gems, userId);
  // award the collectible badge (Persian month label)
  const label = monthLabel(row.month);
  db.prepare(`INSERT OR IGNORE INTO user_badges (user_id, badge_slug, label_fa, label_en, icon)
              VALUES (?,?,?,?, 'medal')`)
    .run(userId, row.badge_slug, `قهرمان ${label.fa}`, `${label.en} Champion`);
  persistNow();
  return { ok: true, gems: cfg.reward_gems, badge: row.badge_slug, profile: getProfile(userId) };
}
export function getBadges(userId) {
  return db.prepare("SELECT badge_slug, label_fa, label_en, icon, earned_at FROM user_badges WHERE user_id=? ORDER BY earned_at DESC").all(userId);
}
const FA_MONTHS = ["ژانویه","فوریه","مارس","آوریل","مه","ژوئن","ژوئیه","اوت","سپتامبر","اکتبر","نوامبر","دسامبر"];
const EN_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
function monthLabel(m) {
  const idx = Number((m || "2026-01").split("-")[1]) - 1;
  return { fa: FA_MONTHS[idx] || m, en: EN_MONTHS[idx] || m };
}

/* ===================================================================
   3) XP RAMP-UP timed challenge event
   =================================================================== */
export function eventDef() {
  return getGameConfig().event;
}
// Start a run: pick N cards from the learner's active program, create a session.
export function startEvent(userId, cardIds) {
  const cfg = getGameConfig().event;
  if (!cfg.enabled) return { ok: false, error: "disabled" };
  const ids = (cardIds || []).slice(0, cfg.questions);
  const r = db.prepare(`INSERT INTO event_runs (user_id, event_slug, card_ids, duration_s, total)
                        VALUES (?,?,?,?,?)`)
    .run(userId, cfg.slug, JSON.stringify(ids), cfg.duration_s, ids.length);
  persistNow();
  return { ok: true, runId: r.lastInsertRowid, duration_s: cfg.duration_s, cardIds: ids };
}
export function finishEvent(userId, runId, correct) {
  const cfg = getGameConfig().event;
  const run = db.prepare("SELECT * FROM event_runs WHERE id=? AND user_id=?").get(runId, userId);
  if (!run || run.status === "finished") return { ok: false, error: "not found" };
  const c = Math.max(0, Math.min(run.total, Number(correct) || 0));
  let xp = c * cfg.xp_per_correct;
  const flawless = run.total > 0 && c === run.total;
  if (flawless) xp += cfg.bonus_all_correct;
  db.prepare("UPDATE event_runs SET status='finished', correct=?, xp_earned=?, finished_at=datetime('now') WHERE id=?")
    .run(c, xp, run.id);
  // credit XP through the normal engine (feeds leagues/streak the same way)
  const profile = awardXp(userId, xp, "event", null);
  persistNow();
  return { ok: true, xp, correct: c, total: run.total, flawless, profile };
}

/* ===================================================================
   4) STREAK REVIVAL — free comeback for lapsed high-streak learners
   =================================================================== */
// A learner qualifies if their last streak (best/current before break) was big
// enough and they've missed enough days to have lost it.
export function revivalStatus(userId) {
  const cfg = getGameConfig().revival;
  const p = getProfile(userId);
  const today = tehranDay();
  const gap = p.last_active ? daysBetween(p.last_active, today) : 0;
  // eligible: had a solid streak, broke it (>=2 day gap), and best_streak large
  const lostStreak = Math.max(p.streak || 0, p.best_streak || 0);
  const eligible = cfg.enabled && gap >= 2 && lostStreak >= cfg.min_streak;
  // count lessons completed today toward the revival requirement
  const doneToday = db.prepare("SELECT COUNT(DISTINCT node_id) c FROM xp_events WHERE user_id=? AND day=? AND reason='lesson' AND node_id IS NOT NULL").get(userId, today).c;
  return {
    enabled: cfg.enabled, eligible,
    lostStreak, lessonsRequired: cfg.lessons_required,
    lessonsDone: Math.min(doneToday, cfg.lessons_required),
    ready: eligible && doneToday >= cfg.lessons_required,
  };
}
export function claimRevival(userId) {
  const st = revivalStatus(userId);
  if (!st.ready) return { ok: false, error: "not ready" };
  const p = getProfile(userId);
  // restore the best streak and keep it alive today
  const restored = Math.max(p.best_streak || 0, p.streak || 0);
  db.prepare("UPDATE learner_profiles SET streak=?, best_streak=?, last_active=? WHERE user_id=?")
    .run(restored, restored, tehranDay(), userId);
  persistNow();
  return { ok: true, streak: restored, profile: getProfile(userId) };
}
