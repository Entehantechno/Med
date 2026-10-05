/* peerstats.js — Round 9 peer-benchmark & premium extras.
   Modelled on UWorld/AMBOSS analytics, مدوفست's daily report and Duolingo's
   Super perks. Everything is DETERMINISTIC (no AI) and every feature has an
   admin switch in game-config → peer.

     • optionStats(cardId)      «شناسنامهٔ سؤال»: % picking each option + avg time
     • percentileFor(...)       result percentile vs all finished tests of same kind
     • dailyReport(userId)      today's answers / accuracy / time vs yesterday + weak topic
     • takeHint(userId, card)   pre-answer Attending hint (gems for free users)
     • saveExplainAsCard(...)   one-tap personal flashcard from a question
     • checkStreakTrial(...)    free premium days at streak milestones
     • jump-ahead quiz          short quiz that unlocks a whole unit             */
import { db, persistNow } from "../db.js";
import { getGameConfig } from "./gameconfig.js";
import { isEnabled } from "./flags.js";
import { getProfile, awardXp, tehranDay } from "./gamify.js";
import { serializeCard } from "./cardserialize.js";
import { ensureTracked } from "./srs.js";

/* Effective config = game-config knobs AND the admin feature flags (a flag OFF
   always wins, so the "Feature flags" page is the single kill-switch). */
export function peerCfg() {
  const c = { ...(getGameConfig().peer || {}) };
  if (!isEnabled("option_stats")) c.option_stats = false;
  if (!isEnabled("peer_percentile")) c.percentile = false;
  if (!isEnabled("daily_report")) c.daily_report = false;
  if (!isEnabled("hint")) c.hint = false;
  if (!isEnabled("save_flashcard")) c.save_flashcard = false;
  if (!isEnabled("jump_ahead")) c.jump_ahead = false;
  if (!isEnabled("premium_trial")) c.trial_days = 0;
  return c;
}

/* ---------- 1. option stats («شناسنامهٔ سؤال») ---------- */
export function optionStats(cardId, nOptions = 0) {
  const cfg = peerCfg();
  if (cfg.option_stats === false) return null;
  const rows = db.prepare("SELECT opt, n FROM option_stats WHERE card_id=?").all(cardId);
  const total = rows.reduce((a, r) => a + r.n, 0);
  const min = Math.max(1, Number(cfg.option_stats_min) || 5);
  if (total < min) return { total, ready: false, min };
  const len = Math.max(nOptions, ...rows.map((r) => r.opt + 1), 0);
  const pct = Array.from({ length: len }, (_, i) => {
    const r = rows.find((x) => x.opt === i);
    return Math.round(((r?.n || 0) / total) * 100);
  });
  const st = db.prepare("SELECT seen, total_ms FROM question_stats WHERE card_id=?").get(cardId);
  const avgSec = st?.seen ? Math.round(st.total_ms / st.seen / 1000) : null;
  return { total, ready: true, pct, avgSec };
}
export function withOptionStats(cards) {
  return cards.map((c) => (Array.isArray(c.options) ? { ...c, optionStats: optionStats(c.id, c.options.length) } : c));
}

/* ---------- 2. percentile vs peers ---------- */
/* kind: 'sim' | 'custom'. Compares this score ratio against every OTHER
   learner's finished test of the same kind (their best per user, so one heavy
   user doesn't skew the distribution). Also time-per-question vs peers. */
export function percentileFor(userId, kind, correct, total, timeMs = 0) {
  const cfg = peerCfg();
  if (cfg.percentile === false || !total) return null;
  const rows = db.prepare(`SELECT user_id, MAX(CAST(correct AS REAL)/MAX(total,1)) AS r,
      AVG(CASE WHEN time_ms>0 THEN CAST(time_ms AS REAL)/MAX(total,1) END) AS spq
    FROM exam_sims WHERE status='finished' AND COALESCE(kind,'sim')=? AND user_id<>? AND total>0
    GROUP BY user_id`).all(kind, userId);
  const min = Math.max(1, Number(cfg.percentile_min) || 5);
  if (rows.length < min) return { ready: false, peers: rows.length, min };
  const mine = correct / total;
  const below = rows.filter((x) => x.r < mine).length;
  const equal = rows.filter((x) => Math.abs(x.r - mine) < 1e-9).length;
  const percentile = Math.round(((below + equal / 2) / rows.length) * 100);
  const peerAvg = Math.round((rows.reduce((a, x) => a + x.r, 0) / rows.length) * 100);
  const spqs = rows.map((x) => x.spq).filter((v) => v > 0);
  const peerSecPerQ = spqs.length ? Math.round(spqs.reduce((a, b) => a + b, 0) / spqs.length / 1000) : null;
  const mySecPerQ = timeMs > 0 ? Math.round(timeMs / total / 1000) : null;
  return { ready: true, peers: rows.length, percentile, peerAvg, myPct: Math.round(mine * 100), peerSecPerQ, mySecPerQ };
}

/* ---------- 3. daily performance report ---------- */
function dayStats(userId, day) {
  const r = db.prepare(`SELECT COUNT(*) n, COALESCE(SUM(correct),0) c, COALESCE(SUM(response_ms),0) ms
    FROM card_attempts WHERE user_id=? AND day=?`).get(userId, day);
  const xp = db.prepare("SELECT COALESCE(SUM(amount),0) s FROM xp_events WHERE user_id=? AND day=?").get(userId, day).s;
  return { answered: r.n, correct: r.c, accuracy: r.n ? Math.round((r.c / r.n) * 100) : null, minutes: Math.round(r.ms / 60000), xp };
}
export function dailyReport(userId, lang = "fa") {
  if (peerCfg().daily_report === false) return null;
  const today = tehranDay();
  const y = new Date(); y.setDate(y.getDate() - 1);
  const yday = tehranDay(y);
  const t = dayStats(userId, today), p = dayStats(userId, yday);
  // weakest topic today (≥3 answers) — via the node's topic or the card's topic slug
  const rows = db.prepare(`SELECT ca.card_id, ca.correct, pn.topic_id FROM card_attempts ca
    LEFT JOIN path_nodes pn ON pn.id = ca.node_id WHERE ca.user_id=? AND ca.day=?`).all(userId, today);
  const byTopic = new Map();
  for (const r of rows) {
    let tid = r.topic_id;
    if (!tid) {
      const fc = db.prepare("SELECT data_json FROM flashcards WHERE id=?").get(r.card_id);
      try { const slug = JSON.parse(fc?.data_json || "{}").topic; if (slug) tid = db.prepare("SELECT id FROM topics WHERE slug=?").get(slug)?.id; } catch { /* */ }
    }
    if (!tid) continue;
    const e = byTopic.get(tid) || { n: 0, c: 0 };
    e.n++; e.c += r.correct ? 1 : 0; byTopic.set(tid, e);
  }
  let weak = null;
  for (const [tid, e] of byTopic) {
    if (e.n < 3) continue;
    const acc = e.c / e.n;
    if (!weak || acc < weak.acc) weak = { tid, acc, n: e.n };
  }
  if (weak) {
    const tp = db.prepare("SELECT slug, name_fa, name_en FROM topics WHERE id=?").get(weak.tid);
    weak = tp ? { slug: tp.slug, name: lang === "fa" ? tp.name_fa : tp.name_en, accuracy: Math.round(weak.acc * 100), answered: weak.n } : null;
  }
  // 7-day sparkline
  const week = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const k = tehranDay(d); const s = dayStats(userId, k); week.push({ day: k, answered: s.answered, accuracy: s.accuracy }); }
  return { today: t, yesterday: p, delta: { answered: t.answered - p.answered, accuracy: (t.accuracy ?? 0) - (p.accuracy ?? 0) }, weak, week };
}

/* ---------- 4. pre-answer hint (AMBOSS Attending Tip) ---------- */
export function hintFor(cardRow, lang = "fa") {
  let d = {}; try { d = JSON.parse(cardRow.data_json || "{}"); } catch { d = {}; }
  const att = lang === "fa" ? (d.attending_fa || d.attending_en) : (d.attending_en || d.attending_fa);
  if (att) return att;
  const golden = lang === "fa" ? d.micro?.golden_fa : d.micro?.golden_en;
  if (golden) return golden;
  const hints = (lang === "fa" ? d.hints_fa : d.hints_en) || [];
  return hints[0] || "";
}
export function hasHint(cardRow) { return !!hintFor(cardRow, "fa"); }
export function takeHint(userId, cardId, lang = "fa") {
  const cfg = peerCfg();
  if (cfg.hint === false) return { error: "disabled" };
  const row = db.prepare("SELECT id, data_json FROM flashcards WHERE id=? AND active=1").get(cardId);
  if (!row) return { error: "not found" };
  const text = hintFor(row, lang);
  if (!text) return { error: "no hint" };
  const p = getProfile(userId);
  const cost = Math.max(0, Number(cfg.hint_gems) || 0);
  let gems = p.gems;
  if (!p.premium_effective && cost > 0) {
    if (p.gems < cost) return { error: "not enough gems", needGems: cost, gems: p.gems };
    gems = p.gems - cost;
    db.prepare("UPDATE learner_profiles SET gems=? WHERE user_id=?").run(gems, userId);
    persistNow();
  }
  return { hint: text, gems, cost: p.premium_effective ? 0 : cost };
}

/* ---------- 5. one-tap flashcard from a question ---------- */
export function saveExplainAsCard(userId, cardId, lang = "fa") {
  if (peerCfg().save_flashcard === false) return { error: "disabled" };
  const row = db.prepare("SELECT id, data_json, difficulty FROM flashcards WHERE id=? AND active=1").get(cardId);
  if (!row) return { error: "not found" };
  const mine = db.prepare(`SELECT f.id, f.data_json FROM learner_cards lc JOIN flashcards f ON f.id=lc.flashcard_id
    WHERE lc.user_id=? AND f.active=1`).all(userId);
  for (const m of mine) { try { if (JSON.parse(m.data_json || "{}").derived_from === cardId) return { ok: true, id: m.id, duplicate: true }; } catch { /* */ } }
  const c = serializeCard(row, lang);
  const other = serializeCard(row, lang === "fa" ? "en" : "fa");
  if (!Array.isArray(c.options) || !c.options.length) return { error: "not mcq" };
  const ex = c.explain?.text || c.micro?.golden || c.micro?.lead || "";
  const exO = other.explain?.text || other.micro?.golden || other.micro?.lead || "";
  const points = [c.micro?.golden, ...(c.micro?.points || [])].filter(Boolean).slice(0, 4);
  const data = {
    course_fa: "کارت من", course_en: "My card", type: "mcq", track: "learn", owner: userId, derived_from: cardId,
    topic: c.topicSlug || undefined,
    q_fa: lang === "fa" ? c.q : other.q, q_en: lang === "en" ? c.q : other.q,
    title_fa: lang === "fa" ? c.q : other.q, title_en: lang === "en" ? c.q : other.q,
    options: c.options.map((o, i) => ({ fa: lang === "fa" ? o.text : other.options[i]?.text || o.text, en: lang === "en" ? o.text : other.options[i]?.text || o.text, correct: !!o.correct })),
    hints_fa: lang === "fa" ? points : [], hints_en: lang === "en" ? points : [],
    ex_fa: lang === "fa" ? ex : exO, ex_en: lang === "en" ? ex : exO,
    micro: { lead_fa: lang === "fa" ? ex : exO, lead_en: lang === "en" ? ex : exO, golden_fa: "", golden_en: "", points_fa: lang === "fa" ? points : [], points_en: lang === "en" ? points : [], options_fa: [], options_en: [], source_fa: "", source_en: "" },
  };
  const info = db.prepare("INSERT INTO flashcards (version, difficulty, data_json, active) VALUES (1,?,?,1)").run(row.difficulty || "medium", JSON.stringify(data));
  const fid = info.lastInsertRowid;
  const topicId = c.topicSlug ? db.prepare("SELECT id FROM topics WHERE slug=?").get(c.topicSlug)?.id || null : null;
  db.prepare("INSERT INTO learner_cards (user_id, flashcard_id, topic_id) VALUES (?,?,?)").run(userId, fid, topicId);
  ensureTracked(userId, fid);
  persistNow();
  return { ok: true, id: fid };
}

/* ---------- 6. premium taste at streak milestones ---------- */
export function checkStreakTrial(userId, streak) {
  const cfg = peerCfg();
  const days = Math.max(0, Number(cfg.trial_days) || 0);
  const ms = (Array.isArray(cfg.trial_milestones) ? cfg.trial_milestones : []).map(Number).filter((n) => n > 0).sort((a, b) => a - b);
  if (!days || !ms.length) return null;
  const p = db.prepare("SELECT trial_tier, premium, premium_until FROM learner_profiles WHERE user_id=?").get(userId);
  if (!p) return null;
  const due = ms.filter((m) => streak >= m && m > (p.trial_tier || 0));
  if (!due.length) return null;
  const reached = due[due.length - 1];
  db.prepare("UPDATE learner_profiles SET trial_tier=? WHERE user_id=?").run(reached, userId);
  // lifetime premium: nothing to add, just mark the tier
  if (p.premium && !p.premium_until) return null;
  const grant = days * due.length;
  return { milestone: reached, days: grant };
}

/* ---------- 7. jump ahead (Duolingo «پرش از واحد») ---------- */
export function jumpAllowed(profile) {
  const cfg = peerCfg();
  if (cfg.jump_ahead === false) return false;
  if (cfg.jump_premium_only && !profile.premium_effective) return false;
  return true;
}
export function jumpUnlockedTopics(userId) {
  return new Set(db.prepare("SELECT topic_id FROM jump_unlocks WHERE user_id=?").all(userId).map((r) => r.topic_id));
}
/* Build the quiz: N questions sampled evenly from the topic's NOT-yet-done free
   nodes (so it truly tests what the learner would skip). */
export function buildJumpQuiz(userId, topicId, lang = "fa") {
  const cfg = peerCfg();
  const topic = db.prepare("SELECT * FROM topics WHERE id=? AND active=1").get(topicId);
  if (!topic) return { error: "topic not found" };
  if (jumpUnlockedTopics(userId).has(topic.id)) return { error: "already unlocked" };
  const nodes = db.prepare(`SELECT pn.id, pn.card_ids FROM path_nodes pn
    LEFT JOIN node_progress np ON np.node_id=pn.id AND np.user_id=?
    WHERE pn.topic_id=? AND pn.active=1 AND COALESCE(pn.premium,0)=0 AND np.completed_at IS NULL ORDER BY pn.ord, pn.id`).all(userId, topic.id);
  if (nodes.length < 2) return { error: "nothing to skip" };
  const n = Math.min(20, Math.max(3, Number(cfg.jump_questions) || 8));
  const pools = nodes.map((nd) => { try { return JSON.parse(nd.card_ids || "[]").map(Number).filter(Boolean); } catch { return []; } }).filter((a) => a.length);
  const picked = new Set();
  let i = 0, guard = 0;
  while (picked.size < n && guard < n * 20) {
    const pool = pools[i % pools.length]; i++; guard++;
    if (!pool.length) continue;
    const cid = pool[Math.floor(Math.random() * pool.length)];
    picked.add(cid);
  }
  const cards = [...picked].map((id) => db.prepare("SELECT id, data_json, difficulty FROM flashcards WHERE id=? AND active=1").get(id)).filter(Boolean)
    .map((c) => { const s = serializeCard(c, lang); delete s.micro; delete s.attending; return s; })
    .filter((c) => Array.isArray(c.options) && c.options.length && String(c.q || "").trim());
  if (cards.length < 2) return { error: "nothing to skip" };
  return { topicId: topic.id, topic: lang === "fa" ? topic.name_fa : topic.name_en, pass: Math.min(100, Math.max(50, Number(cfg.jump_pass) || 80)), skipping: nodes.length, cards };
}
/* Grade server-side: answers = [{cardId, sel}]. On pass, unlock the whole topic
   and mark the skipped free nodes as done (1 star — honest "skipped" marker).*/
export function submitJumpQuiz(userId, topicId, answers = []) {
  const cfg = peerCfg();
  const topic = db.prepare("SELECT * FROM topics WHERE id=? AND active=1").get(topicId);
  if (!topic) return { error: "topic not found" };
  const pass = Math.min(100, Math.max(50, Number(cfg.jump_pass) || 80));
  let correct = 0, total = 0;
  const graded = [];
  for (const a of (Array.isArray(answers) ? answers : []).slice(0, 30)) {
    const cid = parseInt(a?.cardId, 10); const sel = parseInt(a?.sel, 10);
    const row = cid ? db.prepare("SELECT id, data_json FROM flashcards WHERE id=? AND active=1").get(cid) : null;
    if (!row) continue;
    let d = {}; try { d = JSON.parse(row.data_json || "{}"); } catch { d = {}; }
    const opts = d.options || [];
    const ok = !!opts[sel]?.correct;
    total++; if (ok) correct++;
    graded.push({ cardId: cid, correct: ok, correctIdx: opts.findIndex((o) => o.correct) });
  }
  if (!total) return { error: "no answers" };
  const pct = Math.round((correct / total) * 100);
  const passed = pct >= pass;
  let skipped = 0;
  if (passed) {
    db.prepare("INSERT OR IGNORE INTO jump_unlocks (user_id, topic_id, score) VALUES (?,?,?)").run(userId, topic.id, pct);
    const nodes = db.prepare(`SELECT pn.id FROM path_nodes pn LEFT JOIN node_progress np ON np.node_id=pn.id AND np.user_id=?
      WHERE pn.topic_id=? AND pn.active=1 AND COALESCE(pn.premium,0)=0 AND np.completed_at IS NULL`).all(userId, topic.id);
    const now = new Date().toISOString();
    const ins = db.prepare("INSERT INTO node_progress (user_id, node_id, stars, attempts, last_score, completed_at) VALUES (?,?,1,0,?,?)");
    for (const nd of nodes) { ins.run(userId, nd.id, pct, now); skipped++; }
    awardXp(userId, 20 + correct * 2, "jump_ahead", null);
  }
  persistNow();
  return { passed, pct, pass, correct, total, skipped, graded };
}
