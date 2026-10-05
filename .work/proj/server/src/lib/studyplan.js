/* studyplan.js — a personalised, day-by-day STUDY PLAN toward the exam date.

   PHILOSOPHY (per product decision): AI is expensive, so the plan itself is
   built with plain logic — weak topics first, spaced across the days left,
   scaled to the learner's daily minutes. The ONLY place we (optionally) call
   the LLM is a short 1–2 sentence motivational note, and even that has a
   deterministic template fallback so the feature works with zero AI cost. */
import { db, persistNow } from "../db.js";
import { tehranDay } from "./gamify.js";
import { emojiForTopic } from "./topicemoji.js";

// how many days between two YYYY-MM-DD dates (>=0)
function daysBetween(fromISO, toISO) {
  const a = new Date(fromISO + "T00:00:00Z").getTime();
  const b = new Date(toISO + "T00:00:00Z").getTime();
  return Math.max(0, Math.round((b - a) / 86400000));
}
function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/* Rank topics for THIS learner: weakest (by accuracy) first, then unseen
   topics (never practised → high priority), then the rest by exam weight
   (budget = number of questions that subject historically contributes). */
function rankedTopics(userId, lang, program = null) {
  const topics = program
    ? db.prepare("SELECT * FROM topics WHERE active=1 AND program=?").all(program)
    : db.prepare("SELECT * FROM topics WHERE active=1").all();
  const out = topics.map((t) => {
    // accuracy for this topic from card_attempts joined via path_nodes
    const row = db.prepare(`
      SELECT COUNT(*) n, SUM(ca.correct) c
      FROM card_attempts ca
      JOIN path_nodes pn ON pn.id = ca.node_id
      WHERE ca.user_id=? AND pn.topic_id=?`).get(userId, t.id);
    const n = row?.n || 0;
    const acc = n ? Math.round((row.c / n) * 100) : null;
    return {
      slug: t.slug, title: lang === "fa" ? (t.name_fa || t.name_en) : (t.name_en || t.name_fa),
      emoji: t.emoji || emojiForTopic(t.slug), budget: t.budget || 5, answered: n, accuracy: acc,
    };
  });
  // priority score: lower accuracy = higher priority; unseen gets a strong boost;
  // heavier exam weight breaks ties.
  out.sort((a, b) => {
    const pa = a.accuracy === null ? 30 : a.accuracy;   // unseen ~ treat as 30% (needs work)
    const pb = b.accuracy === null ? 30 : b.accuracy;
    if (pa !== pb) return pa - pb;                        // weakest first
    return (b.budget || 0) - (a.budget || 0);            // then heaviest weight
  });
  return out;
}

function motivationTemplate(daysLeft, weakest, lang) {
  if (lang === "fa") {
    if (daysLeft <= 3) return `فقط ${daysLeft} روز تا آزمون! تمرکزت را روی «${weakest}» بگذار و هر روز مرور کن. تو می‌تونی!`;
    if (daysLeft <= 14) return `${daysLeft} روز مانده. با شروع از «${weakest}» و پایبندی به برنامه، آماده می‌شی. ثبات مهم‌تر از سرعت است.`;
    return `${daysLeft} روز فرصت داری — عالیه! ضعیف‌ترین درست الان «${weakest}» است؛ کم‌کم و منظم جلو برو تا بی‌استرس برسی.`;
  }
  if (daysLeft <= 3) return `Only ${daysLeft} days left! Focus on "${weakest}" and review daily. You've got this!`;
  if (daysLeft <= 14) return `${daysLeft} days to go. Start with "${weakest}" and stick to the plan — consistency beats cramming.`;
  return `${daysLeft} days ahead — great runway! Your weakest subject right now is "${weakest}". Go steady and you'll arrive relaxed.`;
}

/* Build the plan. Optionally accepts an `aiNote` already produced by the caller
   (learn.js decides whether to spend an AI call). If none, uses the template. */
export function buildStudyPlan(userId, { examDate, minutesPerDay = 60, lang = "fa", aiNoteFa = "", aiNoteEn = "", program = null }) {
  const today = tehranDay();
  const daysLeft = examDate ? daysBetween(today, examDate) : 14;
  const ranked = rankedTopics(userId, lang, program);
  const weakest = ranked[0]?.title || (lang === "fa" ? "مرور کلی" : "General review");

  // schedule: assign ~2 topics per study day, weakest first, cycling so every
  // topic recurs (spaced repetition of subjects). Reserve the last day for a
  // full mock exam simulation.
  const studyDays = Math.max(1, daysLeft || 1);
  const days = [];
  const perDay = minutesPerDay >= 90 ? 3 : minutesPerDay >= 45 ? 2 : 1;
  let cursor = 0;
  for (let i = 0; i < studyDays; i++) {
    const dateISO = addDays(today, i);
    const isLast = i === studyDays - 1 && studyDays > 1;
    if (isLast) {
      days.push({
        date: dateISO, dayNo: i + 1,
        focus: [{ slug: "__mock__", title: lang === "fa" ? "آزمون آزمایشی کامل" : "Full mock exam", emoji: "📝" }],
        minutes: minutesPerDay, kind: "mock",
      });
      continue;
    }
    const focus = [];
    for (let k = 0; k < perDay; k++) {
      const t = ranked[cursor % ranked.length];
      cursor++;
      focus.push({ slug: t.slug, title: t.title, emoji: t.emoji, accuracy: t.accuracy });
    }
    days.push({ date: dateISO, dayNo: i + 1, focus, minutes: minutesPerDay, kind: "study" });
  }

  const noteFa = aiNoteFa || motivationTemplate(daysLeft, weakest, "fa");
  const noteEn = aiNoteEn || motivationTemplate(daysLeft, weakest, "en");

  const plan = { examDate: examDate || null, daysLeft, minutesPerDay, generatedOn: today, days, weakestFirst: ranked.slice(0, 5) };

  db.prepare(`INSERT INTO study_plans (user_id, exam_date, minutes_per_day, plan_json, ai_note_fa, ai_note_en, created_at)
    VALUES (?,?,?,?,?,?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET exam_date=excluded.exam_date, minutes_per_day=excluded.minutes_per_day,
      plan_json=excluded.plan_json, ai_note_fa=excluded.ai_note_fa, ai_note_en=excluded.ai_note_en, created_at=datetime('now')`)
    .run(userId, examDate || null, minutesPerDay, JSON.stringify(plan), noteFa, noteEn);
  persistNow();

  return { plan, note: lang === "fa" ? noteFa : noteEn, weakest };
}

export function getStudyPlan(userId, lang = "fa") {
  const row = db.prepare("SELECT * FROM study_plans WHERE user_id=?").get(userId);
  if (!row) return null;
  let plan = {}; try { plan = JSON.parse(row.plan_json || "{}"); } catch { plan = {}; }
  return { plan, note: lang === "fa" ? row.ai_note_fa : row.ai_note_en, createdAt: row.created_at };
}

export { rankedTopics };
