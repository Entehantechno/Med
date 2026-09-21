/* ================================================================
   customtest.js — Premium "Create Test" (آزمون‌ساز شخصی).

   Modelled on the UWorld / AMBOSS custom-session builder:
     • scope     — any combination of bank facets (subject, path chapter,
                   booklet chapter, exam type, year range, style…);
     • status    — unused / incorrect / marked / all (per learner);
     • size      — 1..MAX_N questions, random (seeded) or newest-first;
     • mode      — tutor (answer + explanation after each question) or
                   timed (exam-like: no feedback until the end);
     • time      — per-question seconds (default 60) in timed mode.

   Live COUNTS for every option are computed against the selected scope so
   the learner never builds an empty test (facet counts = faceted search).
   Sessions live in the existing exam_sims table with kind='custom' and a
   JSON `config` so they resume after a refresh; answers are recorded per
   card (card_attempts) which also feeds SRS / mistakes / "incorrect" mode.
   ================================================================ */
import { db, persist, persistNow } from "../db.js";
import { awardXp } from "./gamify.js";
import { recordAnswers } from "./analytics.js";
import { matchFacets, buildFacetIndex } from "./cardfacets.js";
import { syllabusFor } from "../data/path-syllabus.js";

export const MAX_N = 100;
export const PRESET_SIZES = [10, 20, 30, 40, 60];

/* ---------- learner question status (UWorld "question mode") ---------- */
export function learnerStatus(userId) {
  const rows = db.prepare(`
    SELECT card_id,
           SUM(correct) AS ok, COUNT(*) AS n,
           MAX(CASE WHEN flagged=1 THEN 1 ELSE 0 END) AS marked,
           MAX(created_at) AS last_at,
           MAX(CASE WHEN correct=1 THEN created_at END) AS last_ok
    FROM card_attempts WHERE user_id=? GROUP BY card_id`).all(userId);
  const seen = new Set(), incorrect = new Set(), marked = new Set(), correct = new Set();
  for (const r of rows) {
    seen.add(r.card_id);
    if (r.marked) marked.add(r.card_id);
    // "incorrect" = the LAST attempt was wrong (UWorld semantics: redo until right)
    const lastWrong = !r.last_ok || (r.last_at && r.last_ok < r.last_at);
    if (lastWrong) incorrect.add(r.card_id); else correct.add(r.card_id);
  }
  return { seen, incorrect, marked, correct };
}

/* Path-chapter (syllabus) of a card: the node title it was curated into,
   plus bank-only cards mapped via source_meta.chapter_fa so the whole bank is available. */
let chapterIndexCache = null;
function pathChapterIndex() {
  const sig = db.prepare("SELECT COUNT(*) n, MAX(id) m FROM path_nodes").get();
  const fSig = db.prepare("SELECT COUNT(*) n, MAX(id) m FROM flashcards WHERE active=1").get();
  const key = `${sig?.n || 0}|${sig?.m || 0}|${fSig?.n || 0}|${fSig?.m || 0}`;
  if (chapterIndexCache && chapterIndexCache.key === key) return chapterIndexCache.map;
  const map = new Map();   // cardId -> { slug(topic), chapter title }
  const topics = Object.fromEntries(db.prepare("SELECT id, slug FROM topics").all().map((t) => [t.id, t.slug]));
  for (const n of db.prepare("SELECT topic_id, title_fa, title_en, card_ids FROM path_nodes WHERE active=1").all()) {
    const fa = String(n.title_fa || "").replace(/ — تمرین بیشتر 👑| \(.*?\)| \(بخش \d+\)/g, "").replace(/^آزمون دستیاری — /, "");
    const en = String(n.title_en || "").replace(/ — Extra practice 👑| \(.*?\)| \(part \d+\)/g, "").replace(/^Residency — /, "");
    let ids = []; try { ids = JSON.parse(n.card_ids || "[]"); } catch { ids = []; }
    for (const id of ids) map.set(id, { topic: topics[n.topic_id] || "", fa, en });
  }
  // Include all remaining bank cards (free, satellite, bank_only) so nothing is omitted
  const extraCards = db.prepare(`
    SELECT id,
           json_extract(data_json, '$.topic') AS topic,
           json_extract(data_json, '$.source_meta.chapter_fa') AS ch_fa,
           json_extract(data_json, '$.source_meta.chapter_en') AS ch_en
      FROM flashcards
     WHERE active=1 AND json_valid(data_json) AND json_extract(data_json, '$.track') = 'learn'
  `).all();
  for (const c of extraCards) {
    if (c.ch_fa && !map.has(c.id)) {
      map.set(c.id, { topic: c.topic || "", fa: c.ch_fa, en: c.ch_en || c.ch_fa });
    }
  }
  chapterIndexCache = { key, map };
  return map;
}

/* ---------- scope filter ---------- */
function asList(v) { return v == null ? null : Array.isArray(v) ? v.filter(Boolean).map(String) : String(v).split(",").filter(Boolean); }

export function normalizeConfig(body = {}) {
  const n = Math.min(MAX_N, Math.max(1, parseInt(body.n, 10) || 20));
  const mode = body.mode === "timed" ? "timed" : "tutor";
  const secPerQ = Math.min(300, Math.max(20, parseInt(body.secPerQ, 10) || 60));
  const status = ["unused", "incorrect", "marked", "all"].includes(body.status) ? body.status : "all";
  const order = body.order === "newest" ? "newest" : body.order === "oldest" ? "oldest" : "random";
  return {
    n, mode, secPerQ, status, order,
    subject: asList(body.subject), topic: asList(body.topic), pathChapter: asList(body.pathChapter),
    chapter: asList(body.chapter), examType: asList(body.examType), year: asList(body.year),
    month: asList(body.month), style: asList(body.style),
    yearFrom: body.yearFrom || null, yearTo: body.yearTo || null,
    premiumOnly: body.premiumOnly === true,
    name: String(body.name || "").slice(0, 80),
  };
}

function inScope(c, cfg, chIdx) {
  if (!matchFacets(c.facets, {
    subject: cfg.subject, chapter: cfg.chapter, examType: cfg.examType, year: cfg.year,
    month: cfg.month, style: cfg.style, yearFrom: cfg.yearFrom, yearTo: cfg.yearTo,
  })) return false;
  if (cfg.topic?.length && !cfg.topic.includes(String(c.data?.topic || ""))) return false;
  if (cfg.pathChapter?.length) {
    const pc = chIdx.get(c.id);
    if (!pc || !cfg.pathChapter.includes(pc.fa)) return false;
  }
  return true;
}
function byStatus(id, cfg, st) {
  if (cfg.status === "unused") return !st.seen.has(id);
  if (cfg.status === "incorrect") return st.incorrect.has(id);
  if (cfg.status === "marked") return st.marked.has(id);
  return true;
}

/* ---------- live counts for the builder ---------- */
export function builderOptions(userId, pool, cfg, lang = "fa") {
  const chIdx = pathChapterIndex();
  const st = learnerStatus(userId);
  const scoped = pool.filter((c) => inScope(c, cfg, chIdx));
  const statusCounts = {
    all: scoped.length,
    unused: scoped.filter((c) => !st.seen.has(c.id)).length,
    incorrect: scoped.filter((c) => st.incorrect.has(c.id)).length,
    marked: scoped.filter((c) => st.marked.has(c.id)).length,
  };
  const available = scoped.filter((c) => byStatus(c.id, cfg, st)).length;
  // facet options: each computed on the pool narrowed by every OTHER filter
  const facets = {};
  const keys = ["subject", "examType", "year", "style", "chapter"];
  for (const k of keys) {
    const others = { ...cfg, [k]: null };
    const sub = pool.filter((c) => inScope(c, others, chIdx) && byStatus(c.id, cfg, st));
    facets[k] = (buildFacetIndex(sub, lang)[k] || []).sort((a, b) => b.count - a.count);
  }
  // topics (subjects of the path) + their syllabus chapters with counts
  const topicRows = db.prepare("SELECT id, slug, name_fa, name_en, emoji, color, ord FROM topics WHERE program='preint' AND active=1 ORDER BY ord, id").all();
  const others = { ...cfg, topic: null, pathChapter: null };
  const sub = pool.filter((c) => inScope(c, others, chIdx) && byStatus(c.id, cfg, st));
  const tCount = new Map(), chCount = new Map();
  for (const c of sub) {
    const t = String(c.data?.topic || "");
    tCount.set(t, (tCount.get(t) || 0) + 1);
    const pc = chIdx.get(c.id);
    if (pc) { const k = `${t}|${pc.fa}`; if (!chCount.has(k)) chCount.set(k, { fa: pc.fa, en: pc.en, count: 0 }); chCount.get(k).count++; }
  }
  const topics = topicRows.map((t) => {
    const syl = syllabusFor(t.slug) || [];
    const chapters = [];
    const seen = new Set();
    for (const ch of syl) {
      const k = `${t.slug}|${ch.fa}`;
      const row = chCount.get(k);
      if (row) { chapters.push({ value: ch.fa, label: lang === "en" ? (ch.en || ch.fa) : ch.fa, count: row.count }); seen.add(k); }
    }
    for (const [k, row] of chCount) if (k.startsWith(`${t.slug}|`) && !seen.has(k)) chapters.push({ value: row.fa, label: lang === "en" ? (row.en || row.fa) : row.fa, count: row.count });
    return {
      slug: t.slug, name: lang === "en" ? (t.name_en || t.name_fa) : t.name_fa, emoji: t.emoji || "", color: t.color,
      count: tCount.get(t.slug) || 0, chapters,
    };
  }).filter((t) => t.count > 0);
  return { available, statusCounts, facets, topics, maxN: MAX_N, presets: PRESET_SIZES };
}

/* ---------- deterministic shuffle (seeded) ---------- */
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function pickCards(userId, pool, cfg, seed = Date.now()) {
  const chIdx = pathChapterIndex();
  const st = learnerStatus(userId);
  let list = pool.filter((c) => inScope(c, cfg, chIdx) && byStatus(c.id, cfg, st));
  if (cfg.order === "newest") list.sort((a, b) => (b.facets.sittingKey - a.facets.sittingKey) || (a.id - b.id));
  else if (cfg.order === "oldest") list.sort((a, b) => (a.facets.sittingKey - b.facets.sittingKey) || (a.id - b.id));
  else {
    const rnd = mulberry32(seed >>> 0);
    for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
    // spread subjects: when several topics are in scope, avoid long same-topic runs
    if (cfg.n < list.length) {
      const buckets = new Map();
      for (const c of list) { const k = String(c.data?.topic || ""); if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(c); }
      if (buckets.size > 1) {
        const out = []; const qs = [...buckets.values()];
        while (out.length < list.length) for (const q of qs) if (q.length) out.push(q.shift());
        list = out;
      }
    }
  }
  return list.slice(0, cfg.n).map((c) => c.id);
}

/* ---------- sessions ---------- */
export function createCustomTest(userId, cfg, cardIds) {
  const durationS = cfg.mode === "timed" ? cardIds.length * cfg.secPerQ : 0;
  const info = db.prepare(`INSERT INTO exam_sims (user_id, card_ids, n, duration_s, topic_scope, status, kind, config)
    VALUES (?,?,?,?,?, 'active', 'custom', ?)`).run(userId, JSON.stringify(cardIds), cardIds.length, durationS,
    (cfg.topic || cfg.subject || ["all"]).join(",").slice(0, 200), JSON.stringify({ ...cfg, answers: {} }));
  persistNow();
  return { id: info.lastInsertRowid, cardIds, durationS };
}
export function getCustomTest(userId, id) {
  const s = db.prepare("SELECT * FROM exam_sims WHERE id=? AND user_id=? AND kind='custom'").get(id, userId);
  if (!s) return null;
  let cfg = {}; try { cfg = JSON.parse(s.config || "{}"); } catch { cfg = {}; }
  let ids = []; try { ids = JSON.parse(s.card_ids || "[]"); } catch { ids = []; }
  return { row: s, cfg, ids, answers: cfg.answers || {} };
}
/* Record one answer (tutor mode grades instantly; timed mode stores the pick
   and grades at finish). Idempotent per card. */
export function answerCustomTest(userId, id, { cardId, correct, sel, responseMs = 0, flagged = false }) {
  const t = getCustomTest(userId, id);
  if (!t || t.row.status !== "active") return { error: "not active" };
  const cid = Number(cardId) || cardId;
  if (!t.ids.includes(cid) && !t.ids.includes(Number(cardId)) && !t.ids.includes(String(cardId))) return { error: "card not in test" };
  const first = !t.answers[cardId] && !t.answers[cid];
  t.answers[cardId] = { correct: !!correct, sel: sel ?? null, ms: responseMs | 0, flagged: !!flagged, at: new Date().toISOString() };
  db.prepare("UPDATE exam_sims SET config=? WHERE id=?").run(JSON.stringify({ ...t.cfg, answers: t.answers }), t.row.id);
  if (first) recordAnswers(userId, [{ cardId: cid, nodeId: null, correct: !!correct, responseMs, flagged: !!flagged, sel: Number.isInteger(sel) ? sel : null }]);
  else persist();
  return { ok: true, answered: Object.keys(t.answers).length, total: t.ids.length };
}
export function finishCustomTest(userId, id, { timeMs = 0 } = {}) {
  const t = getCustomTest(userId, id);
  if (!t) return { error: "not found" };
  if (t.row.status === "finished") return { error: "already finished" };
  const correct = Object.values(t.answers).filter((a) => a.correct).length;
  const total = t.ids.length;
  db.prepare(`UPDATE exam_sims SET status='finished', correct=?, total=?, time_ms=?, finished_at=datetime('now') WHERE id=?`)
    .run(correct, total, Math.max(0, timeMs | 0), t.row.id);
  const xp = correct + (total >= 10 ? 10 : 3);
  const profile = awardXp(userId, xp, "custom_test", null);
  persist();
  return { correct, total, xp, profile, perTopic: perTopicBreakdown(t) };
}
function perTopicBreakdown(t) {
  if (!t.ids || !t.ids.length) return [];
  const out = new Map();
  const placeholders = t.ids.map(() => "?").join(",");
  const rows = db.prepare(`SELECT id, data_json FROM flashcards WHERE id IN (${placeholders})`).all(...t.ids);
  const topicMap = new Map();
  for (const r of rows) {
    let d = {}; try { d = JSON.parse(r.data_json || "{}"); } catch { d = {}; }
    topicMap.set(r.id, d.topic || "?");
  }
  for (const id of t.ids) {
    const k = topicMap.get(id) || "?";
    if (!out.has(k)) out.set(k, { topic: k, total: 0, correct: 0 });
    out.get(k).total++;
    if (t.answers[id]?.correct) out.get(k).correct++;
  }
  return [...out.values()].sort((a, b) => b.total - a.total);
}
export function customHistory(userId, limit = 20) {
  return db.prepare(`SELECT id, n, correct, total, status, duration_s, topic_scope, config, started_at, finished_at
    FROM exam_sims WHERE user_id=? AND kind='custom' ORDER BY id DESC LIMIT ?`).all(userId, limit).map((r) => {
    let cfg = {}; try { cfg = JSON.parse(r.config || "{}"); } catch { cfg = {}; }
    const answered = Object.keys(cfg.answers || {}).length;
    return {
      id: r.id, n: r.n, correct: r.correct, total: r.total, status: r.status, answered,
      mode: cfg.mode, name: cfg.name || "", scope: { topic: cfg.topic, pathChapter: cfg.pathChapter, subject: cfg.subject, status: cfg.status },
      accuracy: r.total ? Math.round((r.correct / r.total) * 100) : null,
      startedAt: r.started_at, finishedAt: r.finished_at,
    };
  });
}
