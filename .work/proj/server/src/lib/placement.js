/* placement.js — Entry placement test. A short quiz spread across the learner's
   active-program topics. We score per-topic, then RECOMMEND a starting point and
   (optionally) let the learner "skip ahead" on strong topics by marking their
   first lesson as already mastered — so returning/knowledgeable users don't start
   from zero. Non-destructive: it only ever ADDS progress, never removes it. */
import { db, persistNow } from "../db.js";
import { getProfile } from "./gamify.js";
import { getGameConfig } from "./gameconfig.js";
import { activeProgramFor } from "./programs.js";
import { serializeCard } from "./cardserialize.js";

// build a balanced quiz: pick a few cards from each topic of the active program,
// tag each card with its topic slug/name so we can score per-topic afterward.
export function buildPlacement(userId, lang = "fa") {
  const cfg = getGameConfig().placement;
  const program = activeProgramFor(userId);
  const topics = db.prepare("SELECT id, slug, name_fa, name_en FROM topics WHERE active=1 AND program=? ORDER BY ord, id").all(program);
  const n = cfg.questions;
  const perTopic = Math.max(1, Math.round(n / Math.max(1, topics.length)));
  const picked = [];
  for (const t of topics) {
    const nodes = db.prepare("SELECT card_ids FROM path_nodes WHERE topic_id=? AND active=1").all(t.id);
    let ids = [];
    for (const nd of nodes) { try { ids.push(...JSON.parse(nd.card_ids || "[]")); } catch { /* */ } }
    ids = [...new Set(ids)];
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    for (const cid of ids.slice(0, perTopic)) {
      const c = db.prepare("SELECT id, data_json, difficulty FROM flashcards WHERE id=? AND active=1").get(cid);
      if (c) picked.push({ ...serializeCard(c, lang), topicSlug: t.slug, topicName: lang === "fa" ? t.name_fa : t.name_en });
    }
  }
  // shuffle the combined set and cap at n
  for (let i = picked.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [picked[i], picked[j]] = [picked[j], picked[i]]; }
  return picked.slice(0, n);
}

/* ---------------- Adaptive mode ----------------
   Serve the placement ONE question at a time. The next question's difficulty is
   raised after a correct answer and lowered after a wrong one, so we converge on
   the learner's real level quickly. `history` is the client-tracked list of
   { cardId, topicSlug, correct, difficulty } for questions already answered.

   We keep a small pool per topic and pick, at the target difficulty, a card the
   learner hasn't seen yet this run. Difficulty ladder: easy < medium < hard. */
const DIFF_ORDER = ["easy", "medium", "hard"];
const DIFF_IDX = (d) => { const i = DIFF_ORDER.indexOf(String(d || "medium")); return i < 0 ? 1 : i; };

// pick the next difficulty from the last answer (staircase / up-down method)
function nextDifficulty(cfg, history) {
  const start = DIFF_IDX(cfg.adaptive_start || "medium");
  if (!history || !history.length) return DIFF_ORDER[start];
  const last = history[history.length - 1];
  let cur = DIFF_IDX(last.difficulty);
  cur = last.correct ? Math.min(DIFF_ORDER.length - 1, cur + 1) : Math.max(0, cur - 1);
  return DIFF_ORDER[cur];
}

// Get the next adaptive card, or null when the quiz is finished (asked `questions`).
export function nextAdaptiveCard(userId, lang = "fa", history = []) {
  const cfg = getGameConfig().placement;
  const n = cfg.questions;
  const asked = (history || []).length;
  if (asked >= n) return { done: true, asked, total: n };

  const program = activeProgramFor(userId);
  const topics = db.prepare("SELECT id, slug, name_fa, name_en FROM topics WHERE active=1 AND program=? ORDER BY ord, id").all(program);
  if (!topics.length) return { done: true, asked, total: n };

  const seen = new Set((history || []).map((h) => h.cardId));
  const targetDiff = nextDifficulty(cfg, history);

  // Prefer a topic we've asked the LEAST about, to keep coverage balanced.
  const countByTopic = {};
  for (const h of (history || [])) countByTopic[h.topicSlug] = (countByTopic[h.topicSlug] || 0) + 1;
  const orderedTopics = [...topics].sort((a, b) => (countByTopic[a.slug] || 0) - (countByTopic[b.slug] || 0));

  // Search outward from the target difficulty (target → then closest neighbours).
  const ti = DIFF_IDX(targetDiff);
  const diffPref = [DIFF_ORDER[ti], DIFF_ORDER[Math.min(2, ti + 1)], DIFF_ORDER[Math.max(0, ti - 1)]]
    .filter((d, i, arr) => arr.indexOf(d) === i);

  const cardsFor = (topicId) => {
    const nodes = db.prepare("SELECT card_ids FROM path_nodes WHERE topic_id=? AND active=1").all(topicId);
    let ids = [];
    for (const nd of nodes) { try { ids.push(...JSON.parse(nd.card_ids || "[]")); } catch { /* */ } }
    return [...new Set(ids)];
  };

  for (const t of orderedTopics) {
    const ids = cardsFor(t.id).filter((id) => !seen.has(id));
    if (!ids.length) continue;
    const cards = ids.map((id) => db.prepare("SELECT id, data_json, difficulty FROM flashcards WHERE id=? AND active=1").get(id)).filter(Boolean);
    for (const wantDiff of diffPref) {
      const match = cards.filter((c) => (c.difficulty || "medium") === wantDiff);
      if (match.length) {
        const c = match[Math.floor(Math.random() * match.length)];
        return { done: false, asked, total: n, targetDiff,
          card: { ...serializeCard(c, lang), topicSlug: t.slug, topicName: lang === "fa" ? t.name_fa : t.name_en, difficulty: c.difficulty || "medium" } };
      }
    }
  }
  // Fallback: any unseen card in any topic (difficulty pool exhausted at target).
  for (const t of orderedTopics) {
    const ids = cardsFor(t.id).filter((id) => !seen.has(id));
    for (const id of ids) {
      const c = db.prepare("SELECT id, data_json, difficulty FROM flashcards WHERE id=? AND active=1").get(id);
      if (c) return { done: false, asked, total: n, targetDiff,
        card: { ...serializeCard(c, lang), topicSlug: t.slug, topicName: lang === "fa" ? t.name_fa : t.name_en, difficulty: c.difficulty || "medium" } };
    }
  }
  return { done: true, asked, total: n }; // ran out of unseen cards → finish early
}

export function placementStatus(userId, lang = "fa") {
  const cfg = getGameConfig().placement;
  const p = getProfile(userId);
  let result = null;
  try { result = p.placement_json ? JSON.parse(p.placement_json) : null; } catch { /* */ }
  // "off" mode behaves like disabled for the learner-facing offer.
  const mode = cfg.mode || (cfg.enabled ? "optional" : "off");
  const enabled = cfg.enabled && mode !== "off";
  const offer = lang === "fa" ? (cfg.offer_fa || "") : (cfg.offer_en || "");
  const intro = lang === "fa" ? (cfg.intro_fa || "") : (cfg.intro_en || "");
  return {
    enabled, mode, done: !!p.placement_done, questions: cfg.questions, result,
    dismissible: cfg.dismissible !== false,
    allow_retake: cfg.allow_retake !== false,
    adaptive: !!cfg.adaptive,
    dismissed: !!p.placement_dismissed,
    offerText: offer || null, introText: intro || null,
    // A smart, plain-language "where to start" recommendation from the last
    // result (null until the learner has taken the test).
    recommendation: result ? buildRecommendation(result, lang) : null,
  };
}

/* Turn a stored placement result into a friendly starting-point recommendation.
   We pick the weakest answered topic as the primary "start here" (biggest
   learning opportunity), and surface the learner's strengths for encouragement.
   Pure/deterministic — no AI, no cost. */
export function buildRecommendation(result, lang = "fa") {
  const fa = lang === "fa";
  const perTopic = (result?.perTopic || []).filter((t) => t.answered > 0 || t.accuracy != null);
  if (!perTopic.length) return null;
  const sorted = [...perTopic].sort((a, b) => a.accuracy - b.accuracy);
  const weakest = sorted[0];
  const strongNames = sorted.filter((t) => t.strong).map((t) => t.name);
  const level = result.level || "beginner";
  const levelName = { beginner: fa ? "مبتدی" : "beginner", intermediate: fa ? "متوسط" : "intermediate", advanced: fa ? "پیشرفته" : "advanced" }[level];

  // Headline + body copy, adapted to the learner's overall level.
  let title, body;
  if (level === "advanced") {
    title = fa ? "شروع قدرتمند! 💪" : "Strong start! 💪";
    body = fa
      ? `سطح تو «${levelName}» ارزیابی شد. برای تثبیت، پیشنهاد می‌کنیم از «${weakest.name}» شروع کنی (پایین‌ترین دقت: ${weakest.accuracy}٪).`
      : `Your level is "${levelName}". To round things out, start with "${weakest.name}" (your lowest accuracy: ${weakest.accuracy}%).`;
  } else if (level === "intermediate") {
    title = fa ? "نقطهٔ شروعت آماده است 🧭" : "Your starting point is ready 🧭";
    body = fa
      ? `سطح تو «${levelName}» است. بهترین جا برای شروع «${weakest.name}» است (دقت: ${weakest.accuracy}٪) تا سریع‌تر پیشرفت کنی.`
      : `Your level is "${levelName}". The best place to begin is "${weakest.name}" (accuracy: ${weakest.accuracy}%) to progress fastest.`;
  } else {
    title = fa ? "بیا از پایه شروع کنیم 🌱" : "Let's start with the basics 🌱";
    body = fa
      ? `از «${weakest.name}» شروع کن؛ قدم‌به‌قدم پیش می‌رویم و پایهٔ محکمی می‌سازیم.`
      : `Begin with "${weakest.name}"; we'll go step by step and build a solid foundation.`;
  }

  return {
    level, levelName,
    startTopicSlug: weakest.slug, startTopicName: weakest.name, startAccuracy: weakest.accuracy,
    strongTopics: strongNames,
    title, body,
  };
}


/* Grade a submitted placement. body.answers = [{ topicSlug, correct }].
   Computes per-topic accuracy + an overall level, stores the result, and
   (if enabled) skips the learner ahead on strong topics. */
export function submitPlacement(userId, answers, lang = "fa") {
  const cfg = getGameConfig().placement;
  const byTopic = {};
  for (const a of (answers || [])) {
    const s = a.topicSlug || "?";
    byTopic[s] = byTopic[s] || { n: 0, c: 0 };
    byTopic[s].n++; if (a.correct) byTopic[s].c++;
  }
  const total = (answers || []).length;
  const correct = (answers || []).filter((a) => a.correct).length;
  const overall = total ? Math.round((correct / total) * 100) : 0;

  const topics = db.prepare("SELECT id, slug, name_fa, name_en FROM topics WHERE active=1").all();
  const nameOf = (slug) => { const t = topics.find((x) => x.slug === slug); return t ? (lang === "fa" ? t.name_fa : t.name_en) : slug; };

  const perTopic = Object.entries(byTopic).map(([slug, v]) => ({
    slug, name: nameOf(slug), answered: v.n, correct: v.c,
    accuracy: v.n ? Math.round((v.c / v.n) * 100) : 0,
    strong: v.n ? (v.c / v.n) * 100 >= cfg.strong_accuracy : false,
  })).sort((a, b) => b.accuracy - a.accuracy);

  const strongTopics = perTopic.filter((t) => t.strong).map((t) => t.slug);
  const level = overall >= 80 ? "advanced" : overall >= 50 ? "intermediate" : "beginner";

  // Resolve the skip behavior. New `skip_behavior` wins; fall back to the legacy
  // `skip_ahead` boolean (true → "mark_done", false → "off") for old configs.
  let behavior = cfg.skip_behavior;
  if (!behavior) behavior = cfg.skip_ahead === false ? "off" : "mark_done";

  let skippedLessons = 0, unlockedTopics = 0;
  if (behavior !== "off" && strongTopics.length) {
    for (const slug of strongTopics) {
      const t = topics.find((x) => x.slug === slug);
      if (!t) continue;
      if (behavior === "mark_done") {
        // Duolingo-style real skip: auto-complete the first lesson (if not done).
        const node = db.prepare("SELECT id FROM path_nodes WHERE topic_id=? AND active=1 AND kind='lesson' ORDER BY ord, id LIMIT 1").get(t.id);
        if (node && !db.prepare("SELECT id FROM node_progress WHERE user_id=? AND node_id=?").get(userId, node.id)) {
          db.prepare("INSERT INTO node_progress (user_id, node_id, stars, attempts, last_score, completed_at) VALUES (?,?,?,?,?,datetime('now'))")
            .run(userId, node.id, 3, 1, 80);
          skippedLessons++;
        }
      } else if (behavior === "unlock") {
        // Honest unlock: no fake progress — just open the topic so the learner
        // can jump in anywhere. The path route reads placement_unlocks.
        db.prepare("INSERT OR IGNORE INTO placement_unlocks (user_id, topic_id) VALUES (?,?)").run(userId, t.id);
        unlockedTopics++;
      }
    }
  }

  // Adaptive extras: record the mode + the highest difficulty the learner
  // reliably answered right (a nice signal for the admin analytics report).
  const cfg2 = getGameConfig().placement;
  const adaptive = !!cfg2.adaptive && (answers || []).some((a) => a.difficulty);
  let ceilingDiff = null;
  if (adaptive) {
    const order = ["easy", "medium", "hard"];
    const rightDiffs = (answers || []).filter((a) => a.correct && a.difficulty).map((a) => order.indexOf(a.difficulty)).filter((i) => i >= 0);
    if (rightDiffs.length) ceilingDiff = order[Math.max(...rightDiffs)];
  }

  const result = { overall, level, perTopic, strongTopics, skippedLessons, unlockedTopics, behavior,
    adaptive, ceilingDiff, questionsAnswered: total, at: new Date().toISOString() };
  db.prepare("UPDATE learner_profiles SET placement_done=1, placement_json=? WHERE user_id=?").run(JSON.stringify(result), userId);
  persistNow();
  return result;
}

/* ---------------- Admin analytics ----------------
   Aggregate every learner's stored placement result into a report the admin can
   act on: how many took it, level distribution, average score, per-topic average
   accuracy (to see which topics learners arrive weak/strong in), and adaptive
   ceiling-difficulty distribution. Reads only stored results — no recompute. */
export function placementAnalytics(lang = "fa", range = "all") {
  const cfg = getGameConfig().placement;
  const rows = db.prepare(
    "SELECT lp.user_id, lp.placement_done, lp.placement_dismissed, lp.placement_json, lp.xp FROM learner_profiles lp"
  ).all();

  // Optional time window: only count results taken within the last N months.
  // "all" (default) keeps everything. Applied to the aggregate + trend + outcome.
  const months = { "3m": 3, "6m": 6, "12m": 12 }[range] || 0;
  const cutoff = months ? (() => { const d = new Date(); d.setMonth(d.getMonth() - months); return d.getTime(); })() : null;
  const withinRange = (res) => {
    if (!cutoff) return true;
    const t = res?.at ? new Date(res.at).getTime() : NaN;
    return isNaN(t) ? false : t >= cutoff;
  };

  const totalLearners = rows.length;
  let taken = 0, dismissed = 0;
  const levels = { beginner: 0, intermediate: 0, advanced: 0 };
  const ceilings = { easy: 0, medium: 0, hard: 0 };
  let scoreSum = 0, adaptiveCount = 0;
  const topicAgg = {}; // slug → { name, accSum, n, strongN }
  // Entry-level → current-progress outcome (validity check): does a higher entry
  // level actually correspond to more lessons completed & more XP today?
  const outcome = {
    beginner: { n: 0, nodesSum: 0, xpSum: 0 },
    intermediate: { n: 0, nodesSum: 0, xpSum: 0 },
    advanced: { n: 0, nodesSum: 0, xpSum: 0 },
  };
  const doneNodesFor = (userId) =>
    db.prepare("SELECT COUNT(*) c FROM node_progress WHERE user_id=? AND completed_at IS NOT NULL").get(userId).c;

  for (const r of rows) {
    if (r.placement_dismissed) dismissed++;
    if (!r.placement_done || !r.placement_json) continue;
    let res = null; try { res = JSON.parse(r.placement_json); } catch { continue; }
    if (!res || !withinRange(res)) continue;
    taken++;
    scoreSum += (res.overall || 0);
    if (levels[res.level] != null) levels[res.level]++;
    if (res.adaptive) { adaptiveCount++; if (res.ceilingDiff && ceilings[res.ceilingDiff] != null) ceilings[res.ceilingDiff]++; }
    for (const tp of (res.perTopic || [])) {
      const a = topicAgg[tp.slug] || (topicAgg[tp.slug] = { slug: tp.slug, name: tp.name, accSum: 0, n: 0, strongN: 0 });
      a.accSum += (tp.accuracy || 0); a.n++; if (tp.strong) a.strongN++;
      a.name = tp.name; // keep latest label
    }
    if (outcome[res.level]) {
      const o = outcome[res.level];
      o.n++; o.nodesSum += doneNodesFor(r.user_id); o.xpSum += (r.xp || 0);
    }
  }

  const byTopic = Object.values(topicAgg).map((a) => ({
    slug: a.slug, name: a.name, learners: a.n,
    avgAccuracy: a.n ? Math.round(a.accSum / a.n) : 0,
    strongPct: a.n ? Math.round((a.strongN / a.n) * 100) : 0,
  })).sort((x, y) => x.avgAccuracy - y.avgAccuracy); // weakest first (most actionable)

  const trend = buildTrend(rows, lang, withinRange);

  // Summarise the outcome per entry level (avg lessons done + avg XP).
  const outcomeByLevel = ["beginner", "intermediate", "advanced"].map((lv) => {
    const o = outcome[lv];
    return { level: lv, learners: o.n,
      avgDoneNodes: o.n ? Math.round((o.nodesSum / o.n) * 10) / 10 : 0,
      avgXp: o.n ? Math.round(o.xpSum / o.n) : 0 };
  });
  // Does the ordering hold (advanced ≥ intermediate ≥ beginner in avg progress)?
  const present = outcomeByLevel.filter((o) => o.learners > 0);
  let predictive = null;
  if (present.length >= 2) {
    const idx = { beginner: 0, intermediate: 1, advanced: 2 };
    const ordered = [...present].sort((a, b) => idx[a.level] - idx[b.level]);
    predictive = ordered.every((o, i) => i === 0 || o.avgDoneNodes >= ordered[i - 1].avgDoneNodes);
  }

  return {
    enabled: !!cfg.enabled, adaptiveOn: !!cfg.adaptive, range,
    totalLearners, taken, dismissed,
    notTaken: Math.max(0, totalLearners - taken),
    takenPct: totalLearners ? Math.round((taken / totalLearners) * 100) : 0,
    avgScore: taken ? Math.round(scoreSum / taken) : 0,
    levels, ceilings, adaptiveCount,
    byTopic, trend,
    outcomeByLevel, predictive,
  };
}

/* Monthly trend of ENTRY level over time: for each month a learner took the
   test, aggregate count + average score + level split. Lets the admin see
   whether incoming learners are getting stronger/weaker. Labels are Shamsi
   (Persian calendar) in fa, Gregorian in en. */
function buildTrend(rows, lang = "fa", withinRange = () => true) {
  const monthLabel = (iso) => {
    const d = new Date(iso);
    if (isNaN(d)) return null;
    try {
      const cal = lang === "fa" ? "fa-IR-u-ca-persian" : "en-US";
      // e.g. "تیر ۱۴۰۵" / "Jul 2026"
      return new Intl.DateTimeFormat(cal, { month: "short", year: "numeric" }).format(d);
    } catch { return iso.slice(0, 7); }
  };
  const buckets = new Map(); // sortKey(YYYY-MM) → { label, count, scoreSum, levels }
  for (const r of rows) {
    if (!r.placement_done || !r.placement_json) continue;
    let res = null; try { res = JSON.parse(r.placement_json); } catch { continue; }
    if (!res || !res.at || !withinRange(res)) continue;
    const key = String(res.at).slice(0, 7); // YYYY-MM (Gregorian) — stable sort key
    const b = buckets.get(key) || { key, label: monthLabel(res.at), count: 0, scoreSum: 0, levels: { beginner: 0, intermediate: 0, advanced: 0 } };
    b.count++; b.scoreSum += (res.overall || 0);
    if (b.levels[res.level] != null) b.levels[res.level]++;
    buckets.set(key, b);
  }
  return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key))
    .map((b) => ({ label: b.label, count: b.count, avgScore: b.count ? Math.round(b.scoreSum / b.count) : 0, levels: b.levels }));
}

/* Export the placement results as a CSV string (one row per learner who took
   the test). Fixed columns + one accuracy column per active topic (wide format,
   Excel-friendly). Deterministic; reads stored results only. */
export function placementAnalyticsCsv(lang = "fa") {
  const topics = db.prepare("SELECT id, slug, name_fa, name_en FROM topics WHERE active=1 ORDER BY ord, id").all();
  const topicName = (t) => lang === "fa" ? (t.name_fa || t.slug) : (t.name_en || t.slug);
  const rows = db.prepare(
    `SELECT u.id AS user_id, u.username, u.name_fa, u.name_en, lp.placement_json, lp.xp
       FROM learner_profiles lp JOIN users u ON u.id = lp.user_id
      WHERE lp.placement_done = 1 AND lp.placement_json IS NOT NULL`
  ).all();
  const doneNodesFor = (userId) =>
    db.prepare("SELECT COUNT(*) c FROM node_progress WHERE user_id=? AND completed_at IS NOT NULL").get(userId).c;

  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = [
    lang === "fa" ? "نام‌کاربری" : "username",
    lang === "fa" ? "نام" : "name",
    lang === "fa" ? "سطح" : "level",
    lang === "fa" ? "نمرهٔ کل٪" : "overall_pct",
    lang === "fa" ? "تطبیقی" : "adaptive",
    lang === "fa" ? "سقف‌سختی" : "ceiling_difficulty",
    lang === "fa" ? "تعداد‌سوال" : "questions_answered",
    lang === "fa" ? "تاریخ" : "taken_at",
    lang === "fa" ? "درس‌های‌تکمیل‌شده" : "lessons_completed",
    lang === "fa" ? "امتیاز‌فعلی(XP)" : "current_xp",
    ...topics.map((t) => topicName(t)),
  ];
  const lines = [header.map(esc).join(",")];

  for (const r of rows) {
    let res = null; try { res = JSON.parse(r.placement_json); } catch { continue; }
    if (!res) continue;
    const accBySlug = {};
    for (const tp of (res.perTopic || [])) accBySlug[tp.slug] = tp.accuracy;
    const name = lang === "fa" ? (r.name_fa || r.name_en || "") : (r.name_en || r.name_fa || "");
    const line = [
      r.username, name, res.level || "", res.overall != null ? res.overall : "",
      res.adaptive ? (lang === "fa" ? "بله" : "yes") : (lang === "fa" ? "خیر" : "no"),
      res.ceilingDiff || "", res.questionsAnswered != null ? res.questionsAnswered : "",
      res.at ? res.at.slice(0, 10) : "",
      doneNodesFor(r.user_id), r.xp != null ? r.xp : 0,
      ...topics.map((t) => accBySlug[t.slug] != null ? accBySlug[t.slug] : ""),
    ];
    lines.push(line.map(esc).join(","));
  }
  return "\uFEFF" + lines.join("\n"); // BOM so Excel reads UTF-8 (Persian) correctly
}

export function skipPlacement(userId) {
  db.prepare("UPDATE learner_profiles SET placement_done=1 WHERE user_id=?").run(userId);
  persistNow();
}

// Learner hides the offer without taking it (dismissible offer). Doesn't mark
// the test as "done" so they can still take it later from the tools menu.
export function dismissPlacement(userId) {
  db.prepare("UPDATE learner_profiles SET placement_dismissed=1 WHERE user_id=?").run(userId);
  persistNow();
}

// Admin: reset a learner's placement so they can retake it (clears result +
// any placement-based unlocks; never touches real lesson progress/stars).
export function resetPlacement(userId) {
  db.prepare("UPDATE learner_profiles SET placement_done=0, placement_dismissed=0, placement_json=NULL WHERE user_id=?").run(userId);
  db.prepare("DELETE FROM placement_unlocks WHERE user_id=?").run(userId);
  persistNow();
  return { ok: true };
}
