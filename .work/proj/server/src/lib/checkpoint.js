// ---------------------------------------------------------------------------
// Section Checkpoint exams (shelf-exam style, cumulative)
// ---------------------------------------------------------------------------
// A Checkpoint is a comprehensive, cumulative test over a whole SECTION — the
// topic "parent" group (e.g. all Internal-Medicine topics, or all Major
// subjects). It MIXES questions drawn from every completed lesson across that
// section so the learner must discriminate between similar diseases and
// mechanisms under a single blueprint, exactly like an NBME subject ("shelf")
// exam. This is evidence-based: cumulative retrieval practice ("the testing
// effect") reliably improves long-term retention over re-studying.
//
// Everything here is AI-free and deterministic. No content is copied from any
// real exam — the questions are the platform's own seeded cards, just resampled
// into a mixed exam blueprint.
// ---------------------------------------------------------------------------
import { db } from "../db.js";
import { serializeCard } from "./cardserialize.js";
import { getGameConfig } from "./gameconfig.js";
import { activeProgramFor } from "./programs.js";

// Human-readable section (parent group) labels. Falls back gracefully for any
// parent that isn't listed (e.g. custom sections an admin might add).
const SECTION_LABELS = {
  internal: { fa: "دروس داخلی", en: "Internal Medicine" },
  major:    { fa: "دروس ماژور", en: "Major Subjects" },
  minor:    { fa: "دروس مینور", en: "Minor Subjects" },
  floating: { fa: "دروس شناور", en: "Floating Subjects" },
  basic:    { fa: "علوم پایه", en: "Basic Sciences" },
};

const SECTION_EMOJI = {
  internal: "🩺", major: "🏥", minor: "🔬", floating: "🧭", basic: "🧬",
};

export function sectionLabel(section, lang = "fa") {
  const l = SECTION_LABELS[section];
  if (l) return lang === "fa" ? l.fa : l.en;
  // fall back to a topic parent that at least reads sensibly
  return section;
}

export function sectionEmoji(section) {
  return SECTION_EMOJI[section] || "📋";
}

function cfg() {
  const c = getGameConfig().checkpoint || {};
  return {
    enabled: c.enabled !== false,
    unlock_ratio: clampNum(c.unlock_ratio, 0.6, 0, 1),
    min_nodes: Math.max(1, intOr(c.min_nodes, 3)),
    question_count: Math.max(3, intOr(c.question_count, 12)),
    pass_ratio: clampNum(c.pass_ratio, 0.7, 0.3, 1),
    per_topic_cap: Math.max(1, intOr(c.per_topic_cap, 3)),
    time_per_q: Math.max(0, intOr(c.time_per_q, 60)),
    xp_reward: Math.max(0, intOr(c.xp_reward, 120)),
    xp_retry: Math.max(0, intOr(c.xp_retry, 30)),
    cooldown_hours: Math.max(0, Number(c.cooldown_hours) || 0),
  };
}
function intOr(v, d) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; }
function clampNum(v, d, lo, hi) { const n = Number(v); if (!Number.isFinite(n)) return d; return Math.min(hi, Math.max(lo, n)); }

// Collect, per section, the topics + node completion for THIS learner in the
// currently active program. Returns a map keyed by parent section.
function sectionMap(userId, program) {
  const topics = db.prepare(
    "SELECT id, slug, parent, name_fa, name_en FROM topics WHERE active=1 AND program=? ORDER BY ord, id"
  ).all(program);
  const nodes = db.prepare(
    "SELECT id, topic_id, card_ids FROM path_nodes WHERE active=1"
  ).all();
  const nodesByTopic = {};
  for (const n of nodes) (nodesByTopic[n.topic_id] ||= []).push(n);
  const done = db.prepare(
    "SELECT node_id FROM node_progress WHERE user_id=? AND completed_at IS NOT NULL"
  ).all(userId);
  const doneSet = new Set(done.map((d) => d.node_id));

  const sections = {};
  for (const t of topics) {
    const key = t.parent || "other";
    const list = nodesByTopic[t.id] || [];
    const s = (sections[key] ||= { section: key, topics: [], totalNodes: 0, doneNodes: 0 });
    let topicDone = 0;
    for (const n of list) if (doneSet.has(n.id)) topicDone++;
    s.topics.push({ id: t.id, slug: t.slug, nodes: list, doneCount: topicDone, total: list.length });
    s.totalNodes += list.length;
    s.doneNodes += topicDone;
  }
  return sections;
}

// Last attempt + best score for a learner in a section.
function attemptInfo(userId, program, section) {
  const best = db.prepare(
    "SELECT MAX(score) AS s, MAX(passed) AS p FROM checkpoint_results WHERE user_id=? AND program=? AND section=?"
  ).get(userId, program, section);
  const last = db.prepare(
    "SELECT score, passed, created_at FROM checkpoint_results WHERE user_id=? AND program=? AND section=? ORDER BY id DESC LIMIT 1"
  ).get(userId, program, section);
  const attempts = db.prepare(
    "SELECT COUNT(*) AS c FROM checkpoint_results WHERE user_id=? AND program=? AND section=?"
  ).get(userId, program, section).c;
  return { bestScore: best?.s || 0, everPassed: !!best?.p, attempts, last: last || null };
}

// Cooldown check: returns remaining minutes (0 if ready).
function cooldownRemaining(last, cooldownHours) {
  if (!last || !cooldownHours) return 0;
  const lastMs = Date.parse((last.created_at || "").replace(" ", "T") + "Z");
  if (!Number.isFinite(lastMs)) return 0;
  const readyAt = lastMs + cooldownHours * 3600 * 1000;
  const rem = readyAt - Date.now();
  return rem > 0 ? Math.ceil(rem / 60000) : 0;
}

// Public list: every section in the active program with eligibility + status.
export function listCheckpoints(userId, lang = "fa") {
  const c = cfg();
  const program = activeProgramFor(userId);
  const sections = sectionMap(userId, program);
  const out = [];
  // Keep a sensible display order for the known sections.
  const order = ["basic", "internal", "major", "minor", "floating"];
  const keys = Object.keys(sections).sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  for (const key of keys) {
    const s = sections[key];
    if (s.totalNodes === 0) continue;
    const ratio = s.totalNodes ? s.doneNodes / s.totalNodes : 0;
    const info = attemptInfo(userId, program, key);
    const unlocked = c.enabled && s.doneNodes >= c.min_nodes && ratio >= c.unlock_ratio;
    const cooldownMin = cooldownRemaining(info.last, c.cooldown_hours);
    out.push({
      section: key,
      label: sectionLabel(key, lang),
      emoji: sectionEmoji(key),
      totalNodes: s.totalNodes,
      doneNodes: s.doneNodes,
      progress: Math.round(ratio * 100),
      requiredNodes: c.min_nodes,
      requiredRatio: Math.round(c.unlock_ratio * 100),
      unlocked,
      questionCount: c.question_count,
      passRatio: Math.round(c.pass_ratio * 100),
      timePerQ: c.time_per_q,
      bestScore: info.bestScore,
      everPassed: info.everPassed,
      attempts: info.attempts,
      cooldownMin,
    });
  }
  return { enabled: c.enabled, program, checkpoints: out };
}

// Gather the candidate card ids from completed nodes in a section, grouped by
// topic (so we can spread the blueprint and cap per topic).
function candidateCardsBySection(userId, program, section) {
  const sections = sectionMap(userId, program);
  const s = sections[section];
  if (!s) return null;
  const doneSet = new Set(
    db.prepare("SELECT node_id FROM node_progress WHERE user_id=? AND completed_at IS NOT NULL")
      .all(userId).map((d) => d.node_id)
  );
  const byTopic = [];
  for (const t of s.topics) {
    const ids = [];
    for (const n of t.nodes) {
      if (!doneSet.has(n.id)) continue;
      try { JSON.parse(n.card_ids || "[]").forEach((cid) => ids.push(cid)); } catch { /* */ }
    }
    if (ids.length) byTopic.push({ topicId: t.id, ids: [...new Set(ids)] });
  }
  return { s, byTopic };
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Build a mixed exam blueprint: round-robin across topics, capped per topic,
// up to question_count. Returns serialized cards (or null if not eligible).
/* Eligibility only (no cards, no cooldown): is this section open to the
   learner right now? Shared by GET /checkpoint/:section and the finish route. */
export function checkpointGate(userId, section) {
  const c = cfg();
  if (!c.enabled) return { error: "disabled" };
  const program = activeProgramFor(userId);
  const cand = candidateCardsBySection(userId, program, section);
  if (!cand) return { error: "unknown section" };
  const { s } = cand;
  const ratio = s.totalNodes ? s.doneNodes / s.totalNodes : 0;
  if (s.doneNodes < c.min_nodes || ratio < c.unlock_ratio) return { error: "locked" };
  return null;
}

export function buildCheckpoint(userId, section, lang = "fa") {
  const c = cfg();
  if (!c.enabled) return { error: "disabled" };
  const program = activeProgramFor(userId);
  const cand = candidateCardsBySection(userId, program, section);
  if (!cand) return { error: "unknown section" };
  const { s, byTopic } = cand;
  const ratio = s.totalNodes ? s.doneNodes / s.totalNodes : 0;
  if (s.doneNodes < c.min_nodes || ratio < c.unlock_ratio) return { error: "locked" };

  const info = attemptInfo(userId, program, section);
  const cooldownMin = cooldownRemaining(info.last, c.cooldown_hours);
  if (cooldownMin > 0) return { error: "cooldown", cooldownMin };

  // Shuffle each topic's pool + the topic order, then round-robin pick with a
  // per-topic cap so no single topic dominates (a real shelf blueprint spreads
  // across the whole section).
  const pools = shuffle(byTopic.map((t) => ({ ...t, ids: shuffle([...t.ids]), taken: 0 })));
  const chosen = [];
  const cap = c.per_topic_cap;
  let progress = true;
  while (chosen.length < c.question_count && progress) {
    progress = false;
    for (const p of pools) {
      if (chosen.length >= c.question_count) break;
      if (p.taken >= cap) continue;
      if (!p.ids.length) continue;
      chosen.push(p.ids.shift());
      p.taken++;
      progress = true;
    }
  }
  // If capping left us short (few topics), relax the cap and top up.
  if (chosen.length < c.question_count) {
    const leftovers = shuffle(pools.flatMap((p) => p.ids));
    for (const id of leftovers) {
      if (chosen.length >= c.question_count) break;
      chosen.push(id);
    }
  }
  const uniq = [...new Set(chosen)].slice(0, c.question_count);
  const cards = uniq
    .map((id) => db.prepare("SELECT id, data_json, difficulty FROM flashcards WHERE id=? AND active=1").get(id))
    .filter(Boolean)
    .map((card) => serializeCard(card, lang));
  shuffle(cards);

  if (!cards.length) return { error: "empty" };
  return {
    section,
    label: sectionLabel(section, lang),
    emoji: sectionEmoji(section),
    cards,
    total: cards.length,
    passRatio: c.pass_ratio,
    passPct: Math.round(c.pass_ratio * 100),
    timePerQ: c.time_per_q,
    bestScore: info.bestScore,
  };
}

// Record a finished checkpoint. Returns { score, passed, xp, best, ... }.
export function finishCheckpoint(userId, section, { correct, total, durationMs }) {
  const c = cfg();
  const program = activeProgramFor(userId);
  const tot = Math.max(1, parseInt(total, 10) || 1);
  const cor = Math.min(tot, Math.max(0, parseInt(correct, 10) || 0));
  const ratio = cor / tot;
  const score = Math.round(ratio * 100);
  const passed = ratio >= c.pass_ratio;
  db.prepare(
    `INSERT INTO checkpoint_results (user_id, program, section, total, correct, score, passed, duration_ms)
     VALUES (?,?,?,?,?,?,?,?)`
  ).run(userId, program, section, tot, cor, score, passed ? 1 : 0, Math.max(0, parseInt(durationMs, 10) || 0));

  // XP: full reward scaled by score when passing; a smaller consolation for a
  // failed attempt (it's still retrieval practice, which is what we reward).
  const xp = passed
    ? Math.round(c.xp_reward * Math.max(c.pass_ratio, ratio))
    : (ratio > 0 ? c.xp_retry : 0);

  const best = db.prepare(
    "SELECT MAX(score) AS s, MAX(passed) AS p FROM checkpoint_results WHERE user_id=? AND program=? AND section=?"
  ).get(userId, program, section);

  return {
    section, label: sectionLabel(section, "fa"),
    correct: cor, total: tot, score, passed, xp,
    passPct: Math.round(c.pass_ratio * 100),
    bestScore: best?.s || score, everPassed: !!best?.p,
  };
}
