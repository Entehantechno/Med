/* srs.js — Spaced-Repetition scheduling facade.
   Default engine is FSRS-6 (modern DSR model, see fsrs.js); a legacy SM-2
   scheduler is kept as an admin-selectable fallback. The public API is
   unchanged so all callers (lessons, review, practice) keep working:
     review(userId, cardId, grade)  grade: 0=wrong,1=hard,2=good,3=easy
     dueCards / dueCount / ensureTracked / getState
   Plus previewSchedule() for the FSRS "next interval per button" UX. */
import { db, persistNow } from "../db.js";
import { getGameConfig } from "./gameconfig.js";
import { schedule as fsrsSchedule, previewIntervals } from "./fsrs.js";

export function tehranDay(d = new Date()) {
  return new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Tehran" });
}
function addDays(dayStr, n) {
  const d = new Date(dayStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysBetween(a, b) {
  if (!a || !b) return 0;
  return Math.max(0, Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 86400000));
}
// our callers use grade 0..3 (wrong/hard/good/easy) → FSRS uses 1..4 (Again/Hard/Good/Easy)
function toFsrsGrade(g) { return Math.min(4, Math.max(1, (g | 0) + 1)); }

export function getState(userId, cardId) {
  return db.prepare("SELECT * FROM srs_state WHERE user_id=? AND card_id=?").get(userId, cardId);
}

function ensureRow(userId, cardId) {
  let s = getState(userId, cardId);
  if (!s) {
    const today = tehranDay();
    db.prepare(`INSERT INTO srs_state
        (user_id, card_id, ease, interval_days, reps, lapses, due, last_reviewed, stability, difficulty, state, scheduler)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(userId, cardId, 2.5, 0, 0, 0, today, today, 0, 0, "new", "fsrs");
    s = getState(userId, cardId);
  }
  return s;
}

/* ---------- FSRS review path ---------- */
function reviewFsrs(userId, cardId, grade, cfg) {
  const today = tehranDay();
  const s = ensureRow(userId, cardId);
  const elapsed = s.last_reviewed ? daysBetween(s.last_reviewed, today) : 0;
  const prev = { stability: s.stability || 0, difficulty: s.difficulty || 0 };
  const g = toFsrsGrade(grade);
  const r = fsrsSchedule(prev, g, elapsed, cfg);
  const reps = grade <= 0 ? 0 : (s.reps || 0) + 1;
  const lapses = grade <= 0 ? (s.lapses || 0) + 1 : (s.lapses || 0);
  const state = grade <= 0 ? "relearning" : "review";
  const due = addDays(today, r.intervalDays);
  db.prepare(`UPDATE srs_state SET stability=?, difficulty=?, interval_days=?, reps=?, lapses=?,
      due=?, last_reviewed=?, state=?, last_grade=?, scheduler='fsrs',
      ease=? WHERE id=?`)
    .run(r.stability, r.difficulty, r.intervalDays, reps, lapses, due, today, state, g,
         // keep the legacy ease column loosely in sync (cosmetic only)
         Math.min(3.0, Math.max(1.3, r.difficulty ? (11 - r.difficulty) / 3 + 1.3 : 2.5)), s.id);
  // append to the FSRS review log (raw training data for the parameter optimizer)
  try {
    db.prepare("INSERT INTO srs_review_log (user_id, card_id, grade, elapsed_days, day) VALUES (?,?,?,?,?)")
      .run(userId, cardId, g, elapsed, today);
  } catch { /* log is best-effort; never block a review */ }
  persistNow();
  return {
    scheduler: "fsrs",
    stability: Math.round(r.stability * 10) / 10,
    difficulty: Math.round(r.difficulty * 10) / 10,
    interval: r.intervalDays, reps, lapses, due,
  };
}

/* ---------- legacy SM-2 review path ---------- */
function reviewSm2(userId, cardId, grade) {
  const today = tehranDay();
  const s = ensureRow(userId, cardId);
  let { ease, interval_days: interval, reps, lapses } = s;
  ease = ease || 2.5;
  if (grade <= 0) {
    reps = 0; lapses += 1; interval = 1;
    ease = Math.max(1.3, ease - 0.2);
  } else {
    reps += 1;
    const q = grade + 2;
    ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = 3;
    else interval = Math.round(interval * ease);
    if (grade === 1) interval = Math.max(1, Math.round(interval * 0.6));
  }
  interval = Math.max(1, interval);
  const due = addDays(today, interval);
  db.prepare("UPDATE srs_state SET ease=?, interval_days=?, reps=?, lapses=?, due=?, last_reviewed=?, state='review', last_grade=?, scheduler='sm2' WHERE id=?")
    .run(ease, interval, reps, lapses, due, today, grade, s.id);
  persistNow();
  return { scheduler: "sm2", ease, interval, reps, lapses, due };
}

/* Update the schedule for a card after a review (grade 0..3). */
export function review(userId, cardId, grade) {
  const cfg = getGameConfig().srs;
  return cfg.scheduler === "sm2" ? reviewSm2(userId, cardId, grade) : reviewFsrs(userId, cardId, grade, cfg);
}

/* Preview next interval (days) per grade button (FSRS UX). Returns { again, hard, good, easy }. */
export function previewSchedule(userId, cardId) {
  const cfg = getGameConfig().srs;
  if (cfg.scheduler !== "fsrs") return null;
  const s = getState(userId, cardId);
  const today = tehranDay();
  const elapsed = s?.last_reviewed ? daysBetween(s.last_reviewed, today) : 0;
  const prev = { stability: s?.stability || 0, difficulty: s?.difficulty || 0 };
  const p = previewIntervals(prev, elapsed, cfg);
  return { again: p[1], hard: p[2], good: p[3], easy: p[4] };
}

/* Cards due for review today (or overdue). */
export function dueCards(userId, limit = 20) {
  const today = tehranDay();
  return db.prepare(`
    SELECT s.card_id, s.due, s.interval_days, s.reps, s.stability
    FROM srs_state s
    JOIN flashcards f ON f.id = s.card_id AND f.active = 1
    WHERE s.user_id = ? AND s.due <= ?
    ORDER BY s.due ASC, s.interval_days ASC
    LIMIT ?`).all(userId, today, limit);
}

export function dueCount(userId) {
  const today = tehranDay();
  return db.prepare("SELECT COUNT(*) AS c FROM srs_state s WHERE s.user_id=? AND s.due<=?").get(userId, today).c;
}

/* Ensure a card is tracked (called when a learner first sees it in a lesson). */
/* Bridge the Qbank → SRS (the "get it wrong, see it again" loop of UWorld+Anki).
   For every card the learner just answered WRONG in a lesson/checkpoint, make
   sure it is tracked and apply an "Again" lapse so the scheduler surfaces it
   again very soon (due next day / relearning). Correct answers are left to the
   normal tracking so they don't get artificially demoted. Returns how many
   cards were pushed back into the review queue. */
export function lapseWrongCards(userId, answers = []) {
  let added = 0;
  // NOTE: review() persists internally, so we must NOT wrap this in a db
  // transaction — doing so would clash with the sql.js commit and throw
  // "cannot commit - no transaction is active".
  for (const a of answers) {
    const cid = parseInt(a?.cardId, 10);
    if (!cid || a.correct) continue;
    ensureTracked(userId, cid);
    try { review(userId, cid, 0); added++; } catch { /* card may be missing */ }
  }
  return added;
}

export function ensureTracked(userId, cardId) {
  const s = getState(userId, cardId);
  if (!s) {
    const today = tehranDay();
    db.prepare(`INSERT OR IGNORE INTO srs_state
        (user_id, card_id, ease, interval_days, reps, lapses, due, last_reviewed, stability, difficulty, state, scheduler)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(userId, cardId, 2.5, 0, 0, 0, today, today, 0, 0, "new", getGameConfig().srs.scheduler);
  }
}

/* Aggregate SRS memory stats for the learner's review dashboard. */
export function srsStats(userId) {
  const today = tehranDay();
  const row = db.prepare(`SELECT COUNT(*) n,
      COALESCE(AVG(NULLIF(stability,0)),0) avgS,
      COALESCE(AVG(NULLIF(difficulty,0)),0) avgD,
      SUM(CASE WHEN stability>=21 THEN 1 ELSE 0 END) mature
    FROM srs_state WHERE user_id=?`).get(userId);
  return {
    tracked: row?.n || 0,
    due: dueCount(userId),
    avgStability: Math.round((row?.avgS || 0) * 10) / 10,
    avgDifficulty: Math.round((row?.avgD || 0) * 10) / 10,
    mature: row?.mature || 0,   // cards with 21+ day stability (well-learned)
    scheduler: getGameConfig().srs.scheduler,
    retention: getGameConfig().srs.desired_retention,
  };
}
