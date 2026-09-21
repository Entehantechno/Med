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

export function serializeMicro(d, lang) {
  const m = d.micro;
  if (!m) {
    // fall back to legacy explain/hints so old cards still show a mini lesson
    const ex = pick(d, "ex", lang) || (Array.isArray(d.hints_fa) ? (lang === "fa" ? d.hints_fa : d.hints_en)?.join(" ") : "");
    if (!ex) return null;
    return { lead: ex, golden: "", points: [], options: [], source: "", media: null };
  }
  const rawLead = lang === "fa" ? m.lead_fa : m.lead_en;
  const rawGolden = lang === "fa" ? m.golden_fa : m.golden_en;
  const { lead, golden } = dedupeGolden(stripCrossRefs(rawLead), stripCrossRefs(rawGolden));
  return {
    lead,
    golden,
    points: ((lang === "fa" ? m.points_fa : m.points_en) || []).map((p) => stripCrossRefs(p)).filter(Boolean),
    options: ((lang === "fa" ? m.options_fa : m.options_en) || []).map((p) => stripCrossRefs(p)).filter(Boolean),
    source: lang === "fa" ? m.source_fa : m.source_en,
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
  let d = {}; try { d = JSON.parse(c.data_json); } catch { d = {}; }
  const rawType = String(d.type || "mcq").toLowerCase();
  const type = rawType === "image" ? "mcq" : (rawType || "mcq");
  const base = {
    id: c.id, difficulty: c.difficulty, type,
    micro: serializeMicro(d, lang),
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
  // default mcq
  base.options = (d.options || []).map((o, i) => {
    let why = lang === "fa" ? (o.why_fa || "") : (o.why_en || "");
    if (!why && d.micro?.options_fa?.[i]) {
      why = lang === "fa" ? d.micro.options_fa[i] : (d.micro.options_en?.[i] || d.micro.options_fa[i]);
    }
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
  if (base.micro && base.options.some((o) => o.why)) base.micro.options = [];
  return base;
}
