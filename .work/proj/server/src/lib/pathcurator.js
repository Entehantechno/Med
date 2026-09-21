/* ================================================================
   pathcurator.js — curate the competitive learning path from the
   shipped past-exam question banks.

   The banks (tools/*-bank/import-payload*.json) contain thousands of past
   pre-internship questions. Importing them naively put EVERY question with a
   lesson on the path — including hundreds of one-question stages with cryptic
   titles — while the promised premium question bank stayed empty.

   ROUND 5: the curator now builds a COMPLETE syllabus-driven path — every
   official question is classified into a standard exam chapter
   (data/path-syllabus.js) and each chapter becomes nodes of ≤15 questions.
   All nodes are free; there is no premium question tier any more (premium =
   unlimited hearts, bank search/filter, no ads).

   (Historic description of the two-tier product, kept for context:)

     1. FREE CURATED PATH — every subject is covered. Each exam chapter keeps
        one clearly-titled stage (~10 questions); fine-grained booklet labels
        ("خون / ITP") are binned into explicit subject stages. Every stage
        carries a subtitle listing the exact concepts it tests, so the learner
        always knows what the stage quizzes.
     2. PREMIUM QUESTION BANK — every question beyond the curated stages is
        flipped to premium=true and detached from the path. It stays fully
        searchable/filterable in /learn/browse and powers exam simulation for
        premium learners.

   Properties:
     * idempotent — running it twice yields the same stages/cards;
     * non-destructive to people — teacher-authored nodes/cards are never
       deleted (stale curated stages are deactivated, keeping progress rows);
     * the ONLY source of truth for official past-exam cards: such a card
       always lives either on exactly one curated stage or in the premium bank.

   Only official cards (source_meta.kind === "past_exam_import") are managed.
   ================================================================ */
import { db, persistNow } from "../db.js";
import { getSetting, setSetting } from "../routes/content.js";
import { canonicalExamType, internalChapterSlug, isInternalMedicineSubject } from "../routes/admin.js";
import { sittingKey } from "./cardfacets.js";
import { syllabusFor, INTERNAL_SUBS } from "../data/path-syllabus.js";

export const CURATOR_VERSION = 7;

const PROGRAM = "preint";

const PART_RE = /\s*\/\s*/;

/* Text before " / " — the coarse section ("خون / ITP" → "خون"). */
function sectionOf(chapter) {
  const s = String(chapter || "").split(PART_RE)[0].trim();
  return s || String(chapter || "").trim();
}
/* Text after " / " — the specific teaching concept, used in subtitles. */
function conceptOf(chapter) {
  const parts = String(chapter || "").split(PART_RE);
  return parts.length > 1 ? parts.slice(1).join(" / ").trim() : "";
}
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 9999; }
function qnum(v) { const n = parseInt(String(v ?? "").replace(/[^\d۰-۹]/g, ""), 10); return Number.isFinite(n) ? n : 0; }
function uniq(arr) { return [...new Set(arr.filter((x) => x != null && String(x).trim()))]; }

/* Deterministic curriculum order: authored lesson part, then pedagogic seq,
   then sitting (newest exam first), then booklet question number. */
function orderKey(card) {
  const sm = card.d.source_meta || {};
  return [num(sm.lesson_part), num(sm.seq), -sittingKey(sm.year, sm.month), qnum(sm.question_no), card.id];
}
function cmpCards(a, b) {
  const ka = orderKey(a), kb = orderKey(b);
  for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] < kb[i] ? -1 : 1;
  return 0;
}

function topicBySlug(slug) {
  return db.prepare("SELECT * FROM topics WHERE slug=? AND program=?").get(slug, PROGRAM);
}
function ensureUmbrellaInternal() {
  let row = topicBySlug("internal");
  if (row) return row;
  const maxOrd = db.prepare("SELECT COALESCE(MAX(ord),0) m FROM topics WHERE program=?").get(PROGRAM).m || 0;
  const info = db.prepare("INSERT INTO topics (slug,name_fa,name_en,parent,budget,color,icon,ord,active,program) VALUES (?,?,?,?,?,?,?,?,1,?)")
    .run("internal", "داخلی (سایر مباحث)", "Internal Medicine (other)", "internal", 0, "#2569b0", "book", maxOrd + 1, PROGRAM);
  return db.prepare("SELECT * FROM topics WHERE id=?").get(info.lastInsertRowid);
}

/* Re-resolve where an official card belongs. Internal-medicine questions
 * distribute across the seven seeded sub-topics by chapter prefix (and the
 * umbrella catches rare unplaceable ones); everything else keeps the topic
 * the importer assigned. */
function resolveTopic(card) {
  const sm = card.d.source_meta || {};
  if (isInternalMedicineSubject(sm.subject_fa, sm.subject_en)) {
    const sub = internalChapterSlug(sm.chapter_fa, sm.chapter_en);
    if (sub && sub !== "internal" && topicBySlug(sub)) return topicBySlug(sub);
    // No booklet chapter: pick the internal sub-specialty whose syllabus the
    // stem matches best instead of dumping the card in the umbrella topic.
    let best = null, bestScore = 0;
    for (const slug of INTERNAL_SUBS) {
      const syl = syllabusFor(slug);
      const ch = classifyCard(card, syl);
      if (!ch) continue;
      const d = card.d || {};
      const stem = `${d.q_fa || ""} ${d.q_en || ""}`.toLowerCase();
      const score = ch.kw.reduce((n, k) => n + (kwRegex(k).test(stem) ? 1 : 0), 0);
      if (score > bestScore) { bestScore = score; best = slug; }
    }
    if (best && topicBySlug(best)) return topicBySlug(best);
    return ensureUmbrellaInternal();
  }
  if (card.d.topic) {
    const row = topicBySlug(card.d.topic);
    if (row) return row;
  }
  return null;
}

/* Explicit concept list + exam-year span, in the requested language. */
function subtitleFor(cards, concepts, conceptsEn, lang = "fa") {
  const en = lang === "en";
  const list = uniq((en ? conceptsEn : concepts) || []).slice(0, 8);
  // Year span keeps the ORIGINAL printed year strings (Persian digits in the
  // fa label), ordered by numeric value.
  const yearRows = uniq(cards.map((c) => (c.d.source_meta || {}).year).filter(Boolean))
    .map((y) => ({ y, n: parseInt(String(y).replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)), 10) }))
    .filter((x) => Number.isFinite(x.n))
    .map((x) => ({ ...x, abs: x.n > 1000 ? x.n : 1300 + x.n }))
    .sort((a, b) => a.abs - b.abs);
  let tail = "";
  if (yearRows.length) {
    const lo = yearRows[0].y, hi = yearRows[yearRows.length - 1].y;
    tail = en
      ? (lo === hi ? `${lo} exam` : `${lo}–${hi} exams`)
      : (lo === hi ? `آزمون ${lo}` : `آزمون‌های ${lo}–${hi}`);
  }
  const head = list.length ? (en ? `Covers: ${list.join(", ")}` : `نکات: ${list.join("، ")}`) : "";
  return [head, tail].filter(Boolean).join(en ? " · " : " · ");
}

function conceptsOf(cards, lang = "fa") {
  return cards.map((c) => {
    const sm = c.d.source_meta || {};
    return (en(lang) ? sm.concept_en || conceptOf(sm.chapter_en) : sm.concept_fa || conceptOf(sm.chapter_fa));
  });
}
const en = (lang) => lang === "en";

function descriptor({ titleFa, titleEn, cards, prefixFa = "", prefixEn = "" }) {
  return {
    title_fa: prefixFa ? `${prefixFa}${titleFa}` : titleFa,
    title_en: prefixEn ? `${prefixEn}${titleEn || titleFa}` : (titleEn || titleFa),
    subtitle_fa: subtitleFor(cards, conceptsOf(cards, "fa"), conceptsOf(cards, "en"), "fa"),
    subtitle_en: subtitleFor(cards, conceptsOf(cards, "en"), conceptsOf(cards, "fa"), "en"),
    ids: cards.map((c) => c.id),
  };
}

/* ---------------- Round 5: syllabus-driven classification ----------------
   Every official card is placed into a chapter of the subject's standard
   syllabus (data/path-syllabus.js) by keyword scoring on its stem + options.
   Each chapter becomes one or more path nodes of at most NODE_MAX questions,
   in curriculum order, titled "<chapter> (۱/۳)". ALL nodes are free — hearts
   are the only brake — so nothing is shed to a premium bank any more. */
const NODE_MAX = 15;
const NODE_MIN = 4;   // chapters with fewer cards fold into a subject review node
/* ROUND 7: each syllabus chapter keeps a FREE core (a proportional share of its
   questions, at least one full node) and the remainder becomes locked
   «تمرین بیشتر 👑» premium nodes placed right after the chapter on the path.
   Premium learners open them; free learners are sent to the premium page. */
export const FREE_SHARE = 0.5;
export const PREMIUM_TITLE_FA = "تمرین بیشتر 👑";
export const PREMIUM_TITLE_EN = "Extra practice 👑";
/* Concept-aware split. The FREE core must teach EVERY sub-topic of the
   chapter: cards are grouped by the syllabus keyword that placed them (their
   sub-topic) and the free set takes at least one card of every group, then
   round-robins across groups up to the free quota. Only repeats of already
   covered sub-topics go to the premium «تمرین بیشتر» nodes. `chapter` is the
   syllabus chapter (for its keyword list); without it the split is by order. */
export function splitFreePremium(list, share = FREE_SHARE, chapter = null) {
  const n = list.length;
  const quota = Math.min(n, Math.max(NODE_MAX, Math.ceil(n * share)));
  if (n - quota < NODE_MIN) return { free: list, premium: [] };
  if (!chapter || !chapter.kw?.length) return { free: list.slice(0, quota), premium: list.slice(quota) };
  const groups = new Map();
  for (const c of list) {
    const k = primaryConcept(c, chapter);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(c);
  }
  // biggest sub-topics first so the free quota is spread proportionally
  const order = [...groups.values()].sort((a, b) => b.length - a.length);
  const picked = new Set();
  for (let round = 0; picked.size < quota || round === 0; round++) {
    let took = false;
    for (const g of order) {
      if (round >= g.length) continue;
      if (round > 0 && picked.size >= quota) break;
      picked.add(g[round].id); took = true;
    }
    if (!took) break;
  }
  const free = list.filter((c) => picked.has(c.id));
  const premium = list.filter((c) => !picked.has(c.id));
  if (premium.length < NODE_MIN) return { free: list, premium: [] };
  return { free, premium };
}
/* The chapter keyword that matched the STEM of a card (its sub-topic);
   options-only matches share one bucket. */
function primaryConcept(card, chapter) {
  const d = card.d || {};
  const stem = `${d.q_fa || ""} ${d.q_en || ""}`.toLowerCase().replace(/[ي]/g, "ی").replace(/[ك]/g, "ک");
  for (const k of chapter.kw) if (kwRegex(k).test(stem)) return k;
  return "\u0000options";
}

const kwCache = new Map();
function kwRegex(k) {
  let re = kwCache.get(k);
  if (!re) {
    // keyword may already be a regex fragment; test as case-insensitive substring
    try { re = new RegExp(k, "i"); } catch { re = new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"); }
    kwCache.set(k, re);
  }
  return re;
}
function cardText(card) {
  const d = card.d || {};
  const opts = (d.options || []).map((o) => `${o?.fa || ""} ${o?.en || ""}`).join(" ");
  const sm = d.source_meta || {};
  return `${d.q_fa || ""} ${d.q_en || ""} ${sm.chapter_fa || ""} ${sm.chapter_en || ""} ${sm.concept_fa || ""} ${sm.concept_en || ""} ${opts}`
    .toLowerCase().replace(/[ي]/g, "ی").replace(/[ك]/g, "ک").replace(/\u200c/g, "\u200c");
}
/* Score a card against every chapter of a syllabus; stem hits weigh more
   than option hits. Returns the best chapter or null when nothing matches. */
export function classifyCard(card, syllabus) {
  if (!syllabus || !syllabus.length) return null;
  const d = card.d || {};
  const stem = `${d.q_fa || ""} ${d.q_en || ""} ${(d.source_meta || {}).chapter_fa || ""} ${(d.source_meta || {}).chapter_en || ""}`.toLowerCase().replace(/[ي]/g, "ی").replace(/[ك]/g, "ک");
  const all = cardText(card);
  let best = null, bestScore = 0;
  for (const ch of syllabus) {
    let score = 0;
    if (ch.neg && ch.neg.length && ch.neg.some((k) => kwRegex(k).test(all))) continue;
    for (const k of ch.kw) {
      const re = kwRegex(k);
      if (re.test(stem)) score += 3;
      else if (re.test(all)) score += 1;
    }
    if (score > bestScore) { bestScore = score; best = ch; }
  }
  return bestScore > 0 ? best : null;
}

/* Plan one topic's nodes from its official cards using the subject syllabus.
 * `prefix` labels an exam track bucket (residency stages carry «آزمون دستیاری — »). */
function planTopic(topic, cards, prefix = {}) {
  const { prefixFa = "", prefixEn = "" } = prefix;
  const pref = (st) => ({ ...st,
    title_fa: prefixFa && !st.title_fa.startsWith(prefixFa) ? `${prefixFa}${st.title_fa}` : st.title_fa,
    title_en: prefixEn && !st.title_en.startsWith(prefixEn) ? `${prefixEn}${st.title_en}` : st.title_en,
  });
  const subjectFa = topic.name_fa;
  const subjectEn = topic.name_en;
  const syllabus = syllabusFor(topic.slug);

  // 1) classify into syllabus chapters (fallback: booklet chapter, then subject)
  const buckets = new Map();   // key -> { fa, en, ord, cards }
  const put = (key, fa, en, ord, c) => {
    if (!buckets.has(key)) buckets.set(key, { key, fa, en, ord, cards: [] });
    buckets.get(key).cards.push(c);
  };
  const unplaced = [];
  for (const c of cards) {
    const ch = classifyCard(c, syllabus);
    if (ch) put(ch.slug, ch.fa, ch.en, syllabus.indexOf(ch), c);
    else unplaced.push(c);
  }
  // unplaced cards: keep the booklet chapter when the booklet had one
  const rest = [];
  for (const c of unplaced) {
    const sm = c.d.source_meta || {};
    const fa = sectionOf(sm.chapter_fa), en = sectionOf(sm.chapter_en);
    if (fa && fa !== subjectFa) put(`booklet:${fa}`, fa, en || fa, 900, c);
    else rest.push(c);
  }
  for (const b of buckets.values()) b.cards.sort(cmpCards);

  // 2) tiny chapters fold into a subject review node (keeps nodes ≥ NODE_MIN)
  const ordered = [...buckets.values()].sort((a, b) => a.ord - b.ord);
  const review = [...rest];
  const keep = [];
  for (const b of ordered) {
    if (b.cards.length < NODE_MIN) review.push(...b.cards); else keep.push(b);
  }
  review.sort(cmpCards);

  // 3) chunk every chapter into nodes of ≤ NODE_MAX, evenly sized
  const stages = [];
  const chunk = (list, fa, en, premium = false) => {
    const parts = Math.max(1, Math.ceil(list.length / NODE_MAX));
    // even split: sizes differ by at most one (no 15,15,…,1 tail)
    const base = Math.floor(list.length / parts), extra = list.length % parts;
    let cursor = 0;
    for (let i = 0; i < parts; i++) {
      const size = base + (i < extra ? 1 : 0);
      const piece = list.slice(cursor, cursor + size);
      cursor += size;
      if (!piece.length) continue;
      const nfa = parts > 1 ? `${fa} (${toFa(i + 1)}/${toFa(parts)})` : fa;
      const nen = parts > 1 ? `${en} (${i + 1}/${parts})` : en;
      stages.push({ ...pref(descriptor({ titleFa: nfa, titleEn: nen, cards: piece })), premium });
    }
  };
  for (const b of keep) {
    for (const c of b.cards) {
      if (!c.d.source_meta) c.d.source_meta = {};
      if (!c.d.source_meta.chapter_fa) c.d.source_meta.chapter_fa = b.fa;
      if (!c.d.source_meta.chapter_en) c.d.source_meta.chapter_en = b.en;
    }
    const { free, premium } = splitFreePremium(b.cards, FREE_SHARE, syllabus.find((ch) => ch.slug === b.key) || null);
    chunk(free, b.fa, b.en);
    if (premium.length) {
      // Supplementary tests for satellite nodes: capped at a reasonable 15-20 questions.
      // Distinct questions covering chapter concepts; any extra questions stay in the bank for custom tests.
      const satCards = premium.slice(0, 20);
      stages.push({ ...pref(descriptor({ titleFa: `${b.fa} — ${PREMIUM_TITLE_FA}`, titleEn: `${b.en} — ${PREMIUM_TITLE_EN}`, cards: satCards })), premium: true });
    }
  }
  if (review.length && review.length < NODE_MIN && stages.length) {
    // a couple of stragglers: append to the last chapter node when it fits
    const last = stages[stages.length - 1];
    if (!last.premium && last.ids.length + review.length <= NODE_MAX) {
      last.ids.push(...review.map((c) => c.id));
      review.length = 0;
    }
  }
  if (review.length) {
    for (const c of review) {
      if (!c.d.source_meta) c.d.source_meta = {};
      if (!c.d.source_meta.chapter_fa) c.d.source_meta.chapter_fa = `${subjectFa} — مرور جامع`;
      if (!c.d.source_meta.chapter_en) c.d.source_meta.chapter_en = `${subjectEn} — Comprehensive review`;
    }
    chunk(review, `${subjectFa} — مرور جامع`, `${subjectEn} — comprehensive review`);
  }
  return { stages: uniqueTitles(stages), bank: [] };
}
const toFa = (n) => String(n).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);

/* Disambiguate repeated titles inside one subject. */
function uniqueTitles(stages) {
  const seen = new Map();
  for (const s of stages) {
    const n = (seen.get(s.title_fa) || 0) + 1;
    seen.set(s.title_fa, n);
    if (n > 1) {
      s.title_fa = `${s.title_fa} (بخش ${n})`;
      s.title_en = `${s.title_en} (part ${n})`;
    }
  }
  return stages;
}

function upsertCuratedNode(topic, stage, ord) {
  const existing = db.prepare("SELECT * FROM path_nodes WHERE topic_id=? AND (title_fa=? OR title_en=?)").get(topic.id, stage.title_fa, stage.title_en);
  if (existing) {
    db.prepare("UPDATE path_nodes SET title_en=?, subtitle_fa=?, subtitle_en=?, curated=1, active=1, ord=?, card_ids=?, premium=? WHERE id=?")
      .run(stage.title_en, stage.subtitle_fa || "", stage.subtitle_en || "", ord, JSON.stringify(stage.ids), stage.premium ? 1 : 0, existing.id);
    return existing.id;
  }
  const info = db.prepare("INSERT INTO path_nodes (topic_id,title_fa,title_en,subtitle_fa,subtitle_en,ord,kind,card_ids,xp_reward,active,curated,premium) VALUES (?,?,?,?,?,?, 'lesson', ?,20,1,1,?)")
    .run(topic.id, stage.title_fa, stage.title_en, stage.subtitle_fa || "", stage.subtitle_en || "", ord, JSON.stringify(stage.ids), stage.premium ? 1 : 0);
  return info.lastInsertRowid;
}

/* Seed demo/import stages carry generic names; once an official curated stage
 * exists for the topic, an emptied one of these must not linger as a blank
 * locked node. */
function isAutoStageTitle(t) {
  return /^درس \d|^آزمون فصل|بخش \d/.test(String(t || ""));
}

export function curateOfficialPath({ force = false } = {}) {
  const version = Number(getSetting("path_curator_version", 0) || 0);
  if (!force && version >= CURATOR_VERSION) return { ok: true, skipped: true, version };

  const rows = db.prepare("SELECT id, data_json, active FROM flashcards").all();
  const official = [];
  for (const c of rows) {
    let d; try { d = JSON.parse(c.data_json); } catch { continue; }
    if (d.track !== "learn" || d.source_meta?.kind !== "past_exam_import") continue;
    official.push({ id: c.id, d });
  }
  if (!official.length) {
    setSetting("path_curator_version", CURATOR_VERSION);
    return { ok: true, empty: true, stages: 0, pathCards: 0, premiumCards: 0, bankOnlyCards: 0, topicsCovered: 0 };
  }

  let stagesCreated = 0, pathCards = 0, premiumCards = 0, bankOnlyCards = 0, topicsCovered = 0, demoRetired = 0;
  const tx = db.transaction(() => {
    const writes = [];
    // key: `${topicId}|${examType}` — preinternship and residency curate into
    // SEPARATE stage buckets inside the same subject topic.
    const byBucket = new Map();
    const bankOnly = [];            // browse-only cards: never path, never premium
    const examTypeOf = (sm) => {
      const examType = canonicalExamType(sm.exam_type) || "پره‌انترنی";
      if (examType && examType !== sm.exam_type) sm.exam_type = examType;
      return examType;
    };
    const isBankOnly = (c) => {
      const sm = c.d.source_meta || {};
      return sm.route === "bank_only" || sm.needs_lesson === true ||
        sm.keyless === true || sm.key_available === false;
    };
    for (const c of official) {
      const sm = c.d.source_meta;
      examTypeOf(sm);
      if (isBankOnly(c)) { bankOnly.push(c); continue; }
      const topic = resolveTopic(c);
      if (!topic) { bankOnly.push(c); continue; }
      if (c.d.topic !== topic.slug) c.d.topic = topic.slug;
      const key = `${topic.id}|${sm.exam_type || "پره‌انترنی"}`;
      if (!byBucket.has(key)) byBucket.set(key, { topic, examType: sm.exam_type || "پره‌انترنی", cards: [] });
      byBucket.get(key).cards.push(c);
    }
    const finalRoute = new Map();      // cardId -> true when curated on path
    const premiumCard = new Set();     // cardIds owned by a premium «تمرین بیشتر» node
    const ownerNode = new Map();       // cardId -> curated node id that owns it
    const wantedNodeIds = new Set();   // node ids that make up the curated path
    const coveredTopicIds = new Set();

    // Deterministic per-topic stage numbering: preinternship stages first,
    // then residency stages, each bucket numbered straight after the last.
    const EXAM_ORDER = { "پره‌انترنی": 0, "دستیاری": 1 };
    const topicBuckets = new Map();
    for (const [key, b] of byBucket) {
      if (!topicBuckets.has(b.topic.id)) topicBuckets.set(b.topic.id, []);
      topicBuckets.get(b.topic.id).push(b);
    }
    for (const buckets of topicBuckets.values()) {
      buckets.sort((a, b) => (EXAM_ORDER[a.examType] ?? 9) - (EXAM_ORDER[b.examType] ?? 9));
      // A residency bucket too small for its own node (< NODE_MIN) merges
      // into the pre-internship bucket of the same subject instead of
      // producing a one-question node. The passport chip still tells the
      // learner each question's true exam.
      if (buckets.length > 1) {
        const tiny = buckets.filter((b, i) => i > 0 && b.cards.length < NODE_MIN);
        if (tiny.length) {
          for (const b of tiny) buckets[0].cards.push(...b.cards);
          buckets.splice(1, buckets.length - 1, ...buckets.slice(1).filter((b) => !tiny.includes(b)));
        }
      }
    }

    for (const buckets of topicBuckets.values()) {
      let ord = 0;
      for (const { topic, examType, cards } of buckets) {
        const isResidency = examType === "دستیاری";
        const prefix = isResidency
          ? { prefixFa: "آزمون دستیاری — ", prefixEn: "Residency — " }
          : {};
        const { stages, bank } = planTopic(topic, cards, prefix);
        if (!stages.length) continue;
        coveredTopicIds.add(topic.id);
        for (const stage of stages) {
          const nid = upsertCuratedNode(topic, stage, ord++);
          wantedNodeIds.add(nid);
          stagesCreated++;
          stage.ids.forEach((id) => { finalRoute.set(id, true); ownerNode.set(id, nid); if (stage.premium) premiumCard.add(id); });
        }
        for (const c of cards) {
          const onPath = finalRoute.has(c.id);
          // Round 5: every path question is FREE (hearts are the only brake;
          // premium = unlimited hearts + bank search + no ads). Cards that
          // could not be placed stay browse-only, never premium-locked.
          // Round 7: cards of a premium «تمرین بیشتر» node are flagged
          // premium (locked node on the path + premium bank); the free core
          // stays free. Unplaced cards remain browse-only.
          c.d.premium = premiumCard.has(c.id);
          c.d.source_meta.route = onPath ? "competitive_path" : "bank_only";
          writes.push(c);
          if (onPath && !c.d.premium) pathCards++; else if (onPath) premiumCards++; else bankOnlyCards++;
        }
      }
      if (coveredTopicIds.has(buckets[0].topic.id)) topicsCovered++;
    }

    // bank_only cards stay exactly that: free browse material, off the path,
    // never flipped into the premium bank by the curator.
    const bankOnlyIds = new Set();
    for (const c of bankOnly) {
      c.d.premium = false;
      const sm = c.d.source_meta || {};
      sm.route = "bank_only";
      sm.needs_lesson = true;
      bankOnlyIds.add(c.id);
      writes.push(c);
      bankOnlyCards++;
    }

    // Global sweep across the program's nodes:
    //  - every official card lives on exactly one curated stage; strip it from
    //    any other node (old auto-import stages, previous curator versions);
    //  - retire nodes emptied that way when they were system-built (curated
    //    marker, demo placeholders, generic auto titles); authored content is
    //    always preserved, even when left empty.
    const officialIds = new Set(official.map((c) => c.id));
    const demoIds = new Set();
    for (const r of rows) {
      let d; try { d = JSON.parse(r.data_json); } catch { continue; }
      if (d.track === "learn" && d.content_origin === "demo_seed") demoIds.add(r.id);
    }
    for (const t of db.prepare("SELECT * FROM topics WHERE program=?", PROGRAM).all(PROGRAM)) {
      const covered = coveredTopicIds.has(t.id);
      const nodes = db.prepare("SELECT * FROM path_nodes WHERE topic_id=? ORDER BY id").all(t.id);
      for (const n of nodes) {
        let ids = []; try { ids = JSON.parse(n.card_ids || "[]"); } catch { ids = []; }
        // Keep an official card on this node ONLY when it is the curated owner;
        // every other node loses it. Demo seed cards leave any covered topic.
        const next = ids.filter((id) => {
          if (bankOnlyIds.has(id)) return false;
          if (officialIds.has(id)) return ownerNode.get(id) === n.id;
          if (covered && demoIds.has(id)) return false;
          return true;
        });
        if (next.length !== ids.length) {
          db.prepare("UPDATE path_nodes SET card_ids=? WHERE id=?").run(JSON.stringify(next), n.id);
        }
        const allSystem = ids.length > 0 && ids.every((id) => officialIds.has(id) || demoIds.has(id));
        const emptyNow = next.length === 0;
        // Retire emptied system/placeholder stages; a teacher-authored node
        // (real non-system cards) is never deactivated.
        if (emptyNow && n.active && ids.length > 0 && (n.curated || allSystem || isAutoStageTitle(n.title_fa))) {
          db.prepare("UPDATE path_nodes SET active=0 WHERE id=?").run(n.id);
          if (ids.some((id) => demoIds.has(id))) demoRetired++;
        }
      }
    }

    for (const c of writes) {
      db.prepare("UPDATE flashcards SET data_json=? WHERE id=?").run(JSON.stringify(c.d), c.id);
    }
    // Hide topics emptied by reorganisation; keep covered topics visible.
    for (const t of db.prepare("SELECT * FROM topics WHERE program=?", PROGRAM).all(PROGRAM)) {
      const live = db.prepare("SELECT COUNT(*) n FROM path_nodes WHERE topic_id=? AND active=1").get(t.id).n;
      if (coveredTopicIds.has(t.id) && !t.active) db.prepare("UPDATE topics SET active=1 WHERE id=?").run(t.id);
      else if (live === 0 && /^official-/.test(t.slug) && t.active) db.prepare("UPDATE topics SET active=0 WHERE id=?").run(t.id);
    }
  });
  tx();
  // setSetting() persistNow()s, and a rawDb.export() while a sql.js
  // transaction is open drops the transaction, so the version stamp (and the
  // file flush) must happen AFTER tx() commits.
  setSetting("path_curator_version", CURATOR_VERSION);
  persistNow();
  return { ok: true, version: CURATOR_VERSION, stages: stagesCreated, pathCards, premiumCards, bankOnlyCards, topicsCovered, demoRetired };
}

