import {flashcardLanguageFallback} from './flashcard-language.js';
import { microMissing, microValue, microSourceHash } from "./lesson-translate.js";
/* cardserialize.js — turn a stored flashcard's data_json into a
   client-ready, language-localized payload supporting all exercise types:
   mcq | truefalse | fill | match | order | compare.
   Also serializes the QB-style microlearning ("درسنامه") block, a dedicated
   answer-explanation ("پاسخنامه") block, visual mnemonics, and rich MEDIA
   (uploaded image/video or Aparat/YouTube embed) attached to any of them. */
import { serializeMedia } from "./medialib.js";
import { stripCrossRefs, dedupeGolden, examSourceLabel } from "./lessontext.js";
import { pickSchematic } from "./schematics.js";


function pick(d, base, lang) {
  return lang === "fa" ? (d[`${base}_fa`] ?? d[`${base}_en`] ?? "") : (d[`${base}_en`] ?? d[`${base}_fa`] ?? "");
}

export function serializeMicro(d, lang, cardId = null) {
  const m = d.micro;
  if (!m) {
    // fall back to legacy explain/hints so old cards still show a mini lesson
    const ex = pick(d, "ex", lang) || (Array.isArray(d.hints_fa) ? (lang === "fa" ? d.hints_fa : d.hints_en)?.join(" ") : "");
    if (!ex) return null;
    return { lead: ex, golden: "", points: [], options: [], source: "", media: null, references: [], reference: null, pending: null };
  }
  // The درسنامه is never shown in the other language as if it were the site
  // language. Fields missing in `lang` are shown in their authored language
  // and marked pending, so the client can request an AI translation.
  const miss = microMissing(m, lang);
  const pending = miss.fields.length
    ? { cardId, from: miss.from, to: lang, fields: miss.fields, hash: microSourceHash(m, miss, lang) }
    : null;
  const valueOf = (k) => (miss.fields.includes(k) ? microValue(m, k, miss.from) : microValue(m, k, lang));
  const rawLead = valueOf("lead");
  const rawGolden = valueOf("golden");
  const { lead, golden } = dedupeGolden(stripCrossRefs(rawLead), stripCrossRefs(rawGolden));
  const normalizeRef = (r) => {
    if (!r || typeof r !== "object") return null;
    const code = r.code || r.short_en || r.short_fa || "";
    if (!code && !r.book_fa && !r.book_en) return null;
    // Book and guideline titles are proper names: a missing language uses the other one.
    return {
      code: String(code || ""),
      book_fa: r.book_fa || r.title_fa || r.book || r.book_en || r.title_en || "",
      book_en: r.book_en || r.title_en || r.book || r.book_fa || r.title_fa || "",
      chapter_fa: r.chapter_fa || r.chapter || "",
      chapter_en: r.chapter_en || r.chapter || "",
      page: r.page ? String(r.page) : "",
      edition: r.edition || "",
      url: r.url || r.source_url || "",
      pdf_url: r.pdf_url || "",
      cover_url: r.cover_url || r.cover || "",
      short_fa: r.short_fa || r.short_en || code || "",
      short_en: r.short_en || r.short_fa || code || "",
      publisher: r.publisher || "",
    };
  };
  // Gather references from all possible shapes the admin editor emits
  const rawRefs = [];
  if (m.reference_fa) rawRefs.push(m.reference_fa);
  if (m.reference_en) rawRefs.push(m.reference_en);
  if (m.reference) rawRefs.push(m.reference);
  if (Array.isArray(m.references)) rawRefs.push(...m.references);
  if (m.referenceEn) rawRefs.push(m.referenceEn);
  // dedupe by code
  const seen = new Set();
  const references = [];
  for (const r of rawRefs) {
    const n = normalizeRef(r);
    if (!n) continue;
    const key = `${n.code}|${n.chapter_fa}|${n.page}`;
    if (seen.has(key)) continue;
    seen.add(key);
    references.push(n);
  }
  // primary reference is FA-first for fa, EN-first for en
  let primary = null;
  if (lang === "fa") primary = normalizeRef(m.reference_fa) || normalizeRef(m.references?.[0]) || normalizeRef(m.reference) || references[0] || null;
  else primary = normalizeRef(m.reference_en) || normalizeRef(m.referenceEn) || normalizeRef(m.references?.[1]) || normalizeRef(m.references?.[0]) || normalizeRef(m.reference) || references[0] || null;
  // also expose fa/en shortcuts for the client to pick without guessing
  const refFa = normalizeRef(m.reference_fa) || normalizeRef(m.references?.[0]) || (lang === "fa" ? primary : null);
  const refEn = normalizeRef(m.reference_en) || normalizeRef(m.referenceEn) || normalizeRef(m.references?.[1]) || (lang === "en" ? primary : null);
  return {
    lead,
    golden,
    points: valueOf("points").map((p) => stripCrossRefs(p)).filter(Boolean),
    options: valueOf("options").map((p) => stripCrossRefs(p)).filter(Boolean),
    source: valueOf("source"),
    pending,
    source_fa: m.source_fa || m.source || "",
    source_en: m.source_en || m.source || "",
    // competitive per-question citation — deep-linkable (code+chapter+page)
    reference: primary,
    reference_fa: refFa,
    reference_en: refEn,
    references,
    // درسنامه can carry an image / uploaded video / Aparat|YouTube embed
    media: serializeMedia(m.media, lang),
  };
}

/* Dedicated answer explanation ("پاسخنامه") — shown AFTER the learner answers.
   Text + optional media. Distinct from the درسنامه (which is a mini-lesson);
   this is the "why the answer is what it is" block, and can be a video. */
export function serializeExplain(d, lang) {
  const e = d.explain;
  if (!e) return null;
  const text = stripCrossRefs(lang === "fa" ? (e.text_fa || e.text_en) : (e.text_en || e.text_fa));
  const media = serializeMedia(e.media, lang);
  if (!text && !media) return null;
  return { text: text || "", media };
}

/* Sketchy-style visual mnemonic: an image + a memorable scene and the hooks
   that link scene elements to facts. Authored by teachers/admins; no AI. */
export function serializeMnemonic(d, lang) {
  const m = d.mnemonic;
  if (!m) return null;
  const scene = lang === "fa" ? (m.scene_fa || m.scene_en) : (m.scene_en || m.scene_fa);
  const hooks = (lang === "fa" ? m.hooks_fa : m.hooks_en) || [];
  const media = serializeMedia(m.media || (m.image ? { url: m.image, kind: "image" } : null), lang);
  if (!m.image && !media && !scene && (!hooks || !hooks.length)) return null;
  return {
    image: m.image || "",
    title: lang === "fa" ? (m.title_fa || m.title_en) : (m.title_en || m.title_fa),
    scene: scene || "",
    hooks: hooks.filter(Boolean),
    // a mnemonic can now be a short video clip too, not just a static image
    media,
  };
}

export function serializeCard(c, lang) {
  let raw = {}; try { raw = JSON.parse(c.data_json) || {}; } catch { raw = {}; }
  // Flashcard question/options follow the flashcard language rule. The درسنامه
  // (micro) is kept raw: it must match the site language (see lesson-translate.js).
  const { micro: rawMicro, ...rest } = raw;
  const d = { ...flashcardLanguageFallback(rest), micro: rawMicro };
  const rawType = String(d.type || "mcq").toLowerCase();
  const type = rawType === "image" ? "mcq" : (rawType || "mcq");
  const base = {
    id: c.id, public_code: c.public_code, difficulty: c.difficulty, type,
    micro: serializeMicro(d, lang, c.id),
    explain: serializeExplain(d, lang),          // پاسخنامه (shown after answering)
    mnemonic: serializeMnemonic(d, lang),
  };
  base.q = pick(d, "q", lang) || pick(d, "title", lang) || pick(d, "questionText", lang);
  const schematic = pickSchematic(d, lang);
  base.image = d.image || d.imageUrl || schematic || null;
  // rich question media (image OR video OR embed). Falls back to legacy `image`.
  base.media = serializeMedia(d.media || (base.image ? { url: base.image, kind: "image" } : null), lang);
  base.source = examSourceLabel(d, lang);
  base.chapter = lang === "fa"
    ? (d.source_meta?.chapter_fa || d.category_fa || "")
    : (d.source_meta?.chapter_en || d.category_en || d.source_meta?.chapter_fa || "");
  base.topicSlug = d.topic || "";
  base.hints = (lang === "fa" ? d.hints_fa : d.hints_en) || [];
  // AMBOSS-style teaching aids (both optional, authored by admin):
  //  • attending: a short "attending physician" tip toward the right answer
  //    (shown AFTER answering — a nudge on how an expert reasons, no AI).
  //  • highlights: key clue phrases in the stem the learner can reveal-highlight
  //    to train "what matters in this vignette".
  base.attending = lang === "fa" ? (d.attending_fa || d.attending_en || "") : (d.attending_en || d.attending_fa || "");
  base.highlights = ((lang === "fa" ? d.highlights_fa : d.highlights_en) || []).filter(Boolean);

  if (type === "truefalse") {
    base.answer = !!d.answer;
    return base;
  }
  if (type === "fill") {
    // client checks typed answer against accepted[]; server keeps the canonical too
    base.accept = (lang === "fa" ? d.accept_fa : d.accept_en) || [lang === "fa" ? d.blank_fa : d.blank_en];
    base.blank = lang === "fa" ? d.blank_fa : d.blank_en;
    return base;
  }
  if (type === "match") {
    // pairs: [ [left_fa,left_en,right_fa,right_en], ... ]
    base.left = (d.pairs || []).map((p, i) => ({ id: i, text: lang === "fa" ? p[0] : p[1] }));
    base.right = (d.pairs || []).map((p, i) => ({ id: i, text: lang === "fa" ? p[2] : p[3] }));
    // correct mapping is same index; client shuffles right side
    return base;
  }
  if (type === "order") {
    // items are in correct order; client shuffles and player restores order
    const items = (lang === "fa" ? d.items_fa : d.items_en) || [];
    base.items = items.map((text, i) => ({ id: i, text }));
    return base;
  }
  if (type === "compare") {
    // Clinical compare & contrast: for each distinguishing feature the learner
    // decides whether it belongs to entity A, B, or both. Trains discrimination
    // between similar diseases/mechanisms — the core medical-exam skill.
    base.entityA = lang === "fa" ? (d.entityA_fa || d.entityA_en) : (d.entityA_en || d.entityA_fa);
    base.entityB = lang === "fa" ? (d.entityB_fa || d.entityB_en) : (d.entityB_en || d.entityB_fa);
    base.features = (d.features || []).map((f, i) => ({
      id: i,
      text: lang === "fa" ? (f.fa || f.en) : (f.en || f.fa),
      belongs: f.belongs === "A" || f.belongs === "B" || f.belongs === "both" ? f.belongs : "A",
    }));
    return base;
  }
  if (type === "stepwise") {
    base.steps = Array.isArray(d.steps) ? d.steps.map((s, i) => ({
      prompt_fa: s.prompt_fa || "", prompt_en: s.prompt_en || s.prompt_fa || "",
      answer_fa: s.answer_fa || "", answer_en: s.answer_en || s.answer_fa || "",
      accept_fa: Array.isArray(s.accept_fa) ? s.accept_fa : (s.accept_fa ? [s.accept_fa] : []),
      accept_en: Array.isArray(s.accept_en) ? s.accept_en : (s.accept_en ? [s.accept_en] : []),
      explanation_fa: s.explanation_fa || "", explanation_en: s.explanation_en || "",
      hint_fa: s.hint_fa || "", hint_en: s.hint_en || "",
      answerType: s.answerType || s.type || "autocomplete",
      options_fa: Array.isArray(s.options_fa) ? s.options_fa : [],
      options_en: Array.isArray(s.options_en) ? s.options_en : [],
    })) : [];
    // include question text from d.q_* as the main stem above the steps
    base.q = pick(d, "q", lang) || pick(d, "title", lang) || pick(d, "questionText", lang);
    return base;
  }
  // default mcq
  base.options = (d.options || []).map((o, i) => {
    let why = lang === "fa" ? (o.why_fa || "") : (o.why_en || "");
    // Native-language analysis only; a missing language is translated (pending micro options).
    if (!why && d.micro) why = microValue(d.micro, "options", lang)[i] || "";
    return {
      text: lang === "fa" ? (o.fa || o.en) : (o.en || o.fa),
      correct: !!o.correct,
      // per-option rationale (UWorld-style): WHY this option is right/wrong.
      // Falls back to micro.options_fa so every card displays distractor analysis.
      why: stripCrossRefs(why || ""),
    };
  });
  // Per-option "why" already appears under each choice — don't reprint it
  // as a second "بررسی گزینه‌ها" block in the micro-lesson.
  if (base.micro && base.options.some((o) => o.why)) {
    base.micro.options = [];
    // the option analysis is shown per choice, so it no longer needs translating
    if (base.micro.pending) {
      const fields = base.micro.pending.fields.filter((k) => k !== "options");
      base.micro.pending = fields.length
        ? { ...base.micro.pending, fields, hash: microSourceHash(rawMicro, { from: base.micro.pending.from, fields }, lang) }
        : null;
    }
  }
  return base;
}
