/* analytics.js — Performance analytics & the crowd-difficulty engine.
   Inspired by Duolingo's Birdbrain: difficulty is not a fixed label but is
   learned from real user error rates, and response time is captured as a
   confidence proxy (a slow correct answer signals weaker recall than a fast
   one). Also powers the learner's performance dashboard, weak-spot detection
   and the "Mistakes" practice hub. */
import { db, persist, persistNow } from "../db.js";
import { tehranDay } from "./gamify.js";

/* Record a single card answer (called once per question in a lesson/review).
   `flagged` = learner marked it to revisit; `guessed` = learner admitted a guess
   (so a correct-but-guessed answer is still surfaced for review). */
export function recordCardAnswer(userId, { cardId, nodeId = null, correct, responseMs = 0, flagged = false, guessed = false, confidence = 0, sel = null, hintUsed = false }) {
  if (!cardId) return;
  const c = correct ? 1 : 0;
  const conf = [0, 1, 2, 3].includes(confidence | 0) ? (confidence | 0) : 0;
  const selIdx = Number.isInteger(sel) && sel >= 0 && sel < 16 ? sel : null;
  db.prepare("INSERT INTO card_attempts (user_id, card_id, node_id, correct, response_ms, day, flagged, guessed, confidence, sel, hint_used) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .run(userId, cardId, nodeId, c, Math.max(0, responseMs | 0), tehranDay(), flagged ? 1 : 0, guessed ? 1 : 0, conf, selIdx, hintUsed ? 1 : 0);
  // per-option pick counter (Round 9 «شناسنامهٔ سؤال»)
  if (selIdx !== null) {
    db.prepare("INSERT INTO option_stats (card_id, opt, n) VALUES (?,?,1) ON CONFLICT(card_id, opt) DO UPDATE SET n=n+1").run(cardId, selIdx);
  }
  // update the crowd difficulty aggregate
  const st = db.prepare("SELECT * FROM question_stats WHERE card_id=?").get(cardId);
  if (st) {
    db.prepare("UPDATE question_stats SET seen=seen+1, correct=correct+?, total_ms=total_ms+?, updated_at=datetime('now') WHERE card_id=?")
      .run(c, Math.max(0, responseMs | 0), cardId);
  } else {
    db.prepare("INSERT INTO question_stats (card_id, seen, correct, total_ms) VALUES (?,?,?,?)")
      .run(cardId, 1, c, Math.max(0, responseMs | 0));
  }
}
export function recordAnswers(userId, answers = []) {
  const tx = db.transaction(() => { for (const a of answers) recordCardAnswer(userId, a); });
  tx(); persist();
}

/* Crowd difficulty label from the observed pass rate. */
export function difficultyLabel(seen, correct) {
  if (!seen) return { key: "unrated", pct: null };
  const pct = Math.round((correct / seen) * 100);
  // lower pass rate → harder
  let key = "medium";
  if (pct >= 85) key = "easy";
  else if (pct >= 60) key = "medium";
  else if (pct >= 40) key = "hard";
  else key = "brutal";
  return { key, pct };
}

/* Learner performance dashboard: daily/weekly totals, accuracy, avg time,
   and the weakest lessons (topics) by accuracy. */
export function performanceDashboard(userId) {
  const today = tehranDay();
  const last7 = db.prepare(`
    SELECT day, COUNT(*) n, SUM(correct) c, SUM(response_ms) ms
    FROM card_attempts WHERE user_id=? AND day >= date(?, '-6 day')
    GROUP BY day ORDER BY day`).all(userId, today);

  const totals = db.prepare("SELECT COUNT(*) n, SUM(correct) c, SUM(response_ms) ms FROM card_attempts WHERE user_id=?").get(userId);
  const todayRow = db.prepare("SELECT COUNT(*) n, SUM(correct) c FROM card_attempts WHERE user_id=? AND day=?").get(userId, today);
  const weekRow = db.prepare("SELECT COUNT(*) n, SUM(correct) c FROM card_attempts WHERE user_id=? AND day >= date(?, '-6 day')").get(userId, today);

  // weak lessons: group by node, lowest accuracy (min 3 answers)
  const weak = db.prepare(`
    SELECT ca.node_id, pn.title_fa, pn.title_en,
           COUNT(*) n, SUM(ca.correct) c
    FROM card_attempts ca LEFT JOIN path_nodes pn ON pn.id = ca.node_id
    WHERE ca.user_id=? AND ca.node_id IS NOT NULL
    GROUP BY ca.node_id HAVING n >= 3
    ORDER BY (CAST(SUM(ca.correct) AS REAL)/COUNT(*)) ASC, n DESC
    LIMIT 5`).all(userId);

  const acc = (r) => (r && r.n ? Math.round((r.c / r.n) * 100) : 0);
  const avgSec = (r) => (r && r.n && r.ms ? Math.round((r.ms / r.n) / 100) / 10 : 0);
  return {
    today: { answered: todayRow?.n || 0, accuracy: acc(todayRow) },
    week: { answered: weekRow?.n || 0, accuracy: acc(weekRow) },
    allTime: { answered: totals?.n || 0, accuracy: acc(totals), avgSec: avgSec(totals) },
    daily: last7.map((d) => ({ day: d.day, answered: d.n, accuracy: d.n ? Math.round((d.c / d.n) * 100) : 0 })),
    weakTopics: weak.map((w) => ({
      node_id: w.node_id, title_fa: w.title_fa, title_en: w.title_en,
      answered: w.n, accuracy: Math.round((w.c / w.n) * 100),
    })),
  };
}

/* The learner's recent mistakes → "Mistakes" practice hub. */
export function mistakeCardIds(userId, limit = 20) {
  // cards the user most recently got wrong and hasn't since gotten right
  const rows = db.prepare(`
    SELECT ca.card_id,
           MAX(CASE WHEN ca.correct=1 THEN ca.created_at END) AS last_right,
           MAX(CASE WHEN ca.correct=0 THEN ca.created_at END) AS last_wrong
    FROM card_attempts ca
    JOIN flashcards f ON f.id = ca.card_id AND f.active=1
    WHERE ca.user_id=?
    GROUP BY ca.card_id`).all(userId);
  return rows
    .filter((r) => r.last_wrong && (!r.last_right || r.last_wrong > r.last_right))
    .sort((a, b) => (b.last_wrong || "").localeCompare(a.last_wrong || ""))
    .slice(0, limit)
    .map((r) => r.card_id);
}

/* ---- Error taxonomy (deterministic, AI-free) --------------------------------
   After a quiz we help the learner understand WHY they missed, not just that
   they missed. Each wrong answer is bucketed into one of three research-backed
   error types (knowledge vs. reasoning vs. careless) using signals we already
   capture — no AI, no cost:

   • careless   — a fast wrong answer on a question most peers get right
                  (crowd pass-rate high) → a slip, not a knowledge gap.
   • reasoning  — the learner flagged it, admitted a guess, or took a long time
                  on a mid-difficulty item → they had the knowledge but the
                  clinical interpretation/decision faltered.
   • knowledge  — everything else wrong → a genuine content gap to study.

   `answers` = [{ cardId, correct, responseMs, flagged, guessed }] for one quiz. */
export function classifyErrors(answers = []) {
  const buckets = { knowledge: 0, reasoning: 0, careless: 0 };
  const items = [];
  const wrong = answers.filter((a) => a && !a.correct);
  for (const a of wrong) {
    const cid = parseInt(a.cardId, 10);
    const ms = Math.max(0, parseInt(a.responseMs, 10) || 0);
    const flagged = !!a.flagged, guessed = !!a.guessed;
    // crowd pass-rate for this card (how "easy" it is for peers)
    let passPct = null;
    if (cid) {
      const st = db.prepare("SELECT seen, correct FROM question_stats WHERE card_id=?").get(cid);
      if (st && st.seen >= 5) passPct = Math.round((st.correct / st.seen) * 100);
    }
    let type;
    if (!flagged && !guessed && ms > 0 && ms < 8000 && passPct != null && passPct >= 75) {
      type = "careless";        // fast miss on an easy item → a slip
    } else if (flagged || guessed || (ms >= 25000 && (passPct == null || passPct < 85))) {
      type = "reasoning";       // uncertainty / long deliberation → interpretation
    } else {
      type = "knowledge";       // didn't know it → content gap
    }
    buckets[type]++;
    items.push({ cardId: cid || null, type });
  }
  const total = wrong.length;
  return {
    total,
    counts: buckets,
    items,
    // the learner's dominant error mode (null when they made no mistakes)
    dominant: total ? Object.entries(buckets).sort((a, b) => b[1] - a[1])[0][0] : null,
  };
}

/* ---- Confidence-Based Assessment (CBA) --------------------------------------
   A core clinical-reasoning skill is knowing what you know. Before checking an
   answer the learner declares confidence (1=low, 2=medium, 3=high). We reward
   HONEST calibration, not bravado:

     high + correct  → +3   (justified certainty)
     medium + correct→ +2
     low + correct   → +1
     low + wrong     →  0    (honest "I wasn't sure" — no penalty)
     medium + wrong  → -1
     high + wrong    → -2    (dangerous overconfidence — the costly clinical error)

   Returns the summed calibration score for a quiz (used only as a coaching
   number; it never reduces XP so learners aren't discouraged from declaring). */
const CONF_SCORE = {
  1: { correct: 1, wrong: 0 },
  2: { correct: 2, wrong: -1 },
  3: { correct: 3, wrong: -2 },
};
export function confidenceQuizScore(answers = []) {
  let score = 0, declared = 0, overconfident = 0, humble = 0;
  for (const a of answers) {
    const conf = a?.confidence | 0;
    if (!CONF_SCORE[conf]) continue;    // 0 = not declared → skipped
    declared++;
    score += CONF_SCORE[conf][a.correct ? "correct" : "wrong"];
    if (conf === 3 && !a.correct) overconfident++;   // sure but wrong
    if (conf === 1 && a.correct) humble++;           // right but unsure
  }
  return { score, declared, overconfident, humble };
}

/* Lifetime calibration report: for each declared confidence level, how often was
   the learner actually right? Well-calibrated learners show a rising accuracy
   from low→high. The gap between felt-certainty and real accuracy is the
   teachable signal. Returns null until the learner has declared enough. */
export function calibrationReport(userId, minDeclared = 8) {
  const rows = db.prepare(`
    SELECT confidence AS conf, COUNT(*) n, SUM(correct) c
    FROM card_attempts
    WHERE user_id=? AND confidence IN (1,2,3)
    GROUP BY confidence`).all(userId);
  const total = rows.reduce((s, r) => s + r.n, 0);
  const byLevel = { 1: { n: 0, acc: null }, 2: { n: 0, acc: null }, 3: { n: 0, acc: null } };
  for (const r of rows) byLevel[r.conf] = { n: r.n, acc: r.n ? Math.round((r.c / r.n) * 100) : null };

  // overconfidence index: accuracy WHEN the learner felt "high" (3). Below ~80%
  // means they trust themselves more than warranted — a clinical safety flag.
  const highAcc = byLevel[3].acc;
  let verdict = "building";               // not enough data yet
  if (total >= minDeclared) {
    const lowAcc = byLevel[1].acc, medAcc = byLevel[2].acc;
    // "calibrated" when accuracy rises with confidence and high is trustworthy
    const rising = [lowAcc, medAcc, highAcc].filter((x) => x != null);
    const monotone = rising.length >= 2 && rising.every((v, i, arr) => i === 0 || v >= arr[i - 1] - 5);
    if (highAcc != null && highAcc < 75) verdict = "overconfident";
    else if (monotone && highAcc != null && highAcc >= 80) verdict = "calibrated";
    else verdict = "mixed";
  }
  return { total, byLevel, verdict, highAcc };
}

/* Cards the learner FLAGGED to revisit OR answered correctly but admitted was a
   GUESS ("a lucky guess is a miss in disguise"). Most-recent first. A card is
   dropped once the learner later answers it correctly WITHOUT flag/guess. */
export function flaggedCardIds(userId, limit = 30) {
  const rows = db.prepare(`
    SELECT ca.card_id,
           MAX(ca.created_at) AS last_at,
           MAX(CASE WHEN (ca.flagged=1 OR ca.guessed=1) THEN ca.created_at END) AS last_marked,
           MAX(CASE WHEN (ca.correct=1 AND ca.flagged=0 AND ca.guessed=0) THEN ca.created_at END) AS last_clean
    FROM card_attempts ca
    JOIN flashcards f ON f.id = ca.card_id AND f.active=1
    WHERE ca.user_id=?
    GROUP BY ca.card_id`).all(userId);
  return rows
    .filter((r) => r.last_marked && (!r.last_clean || r.last_marked > r.last_clean))
    .sort((a, b) => (b.last_marked || "").localeCompare(a.last_marked || ""))
    .slice(0, limit)
    .map((r) => r.card_id);
}
