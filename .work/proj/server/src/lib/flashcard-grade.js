import crypto from "crypto";
import { pointHitsHotspot } from "./hotspot.js";

const SECRET = process.env.FLASH_TOKEN_SECRET || process.env.JWT_SECRET || "medlab-flash-token";

export function flashTok(cardId, kind, i) {
  const msg = `${Number(cardId) || 0}|${kind}|${i}`;
  return crypto.createHmac("sha256", SECRET).update(msg).digest("base64url").slice(0, 12);
}

function tokIndex(cardId, kind, token, n) {
  const want = String(token || "");
  if (!want) return -1;
  for (let i = 0; i < n; i++) if (flashTok(cardId, kind, i) === want) return i;
  return -1;
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const arr = (x) => (Array.isArray(x) ? x : String(x || "").split(/[,\n]/)).map((s) => String(s).trim()).filter(Boolean);
const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

function unionAccept(primary, ...extras) {
  const out = [];
  const seen = new Set();
  for (const item of [...arr(primary), ...extras]) {
    const t = String(item || "").trim();
    if (!t) continue;
    const key = norm(t);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

function textMatches(got, accepted) {
  const g = norm(got);
  if (!g) return false;
  return accepted.some((a) => norm(a) === g);
}

function coerceTf(v) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") {
    if (v === 0) return false;
    if (v === 1) return true;
    return null;
  }
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return null;
  if (["1", "true", "yes", "on", "درست"].includes(s)) return true;
  if (["0", "false", "no", "off", "نادرست"].includes(s)) return false;
  return null;
}

function resolveType(full) {
  const raw = String(full?.type || "mcq").toLowerCase();
  if (raw === "image") return "mcq";
  return raw || "mcq";
}

export function studentSafeFlashcard(full) {
  if (!full || typeof full !== "object") return full;
  const out = { ...full };
  if (Array.isArray(out.options)) {
    out.options = out.options.map(({ correct, why_fa, why_en, why, ...rest }) => rest);
  }
  delete out.blank_fa; delete out.blank_en;
  delete out.accept_fa; delete out.accept_en;
  delete out.answer;
  if (Array.isArray(out.pairs)) {
    const left = out.pairs.map((p, i) => ({ id: flashTok(full.id, "L", i), fa: p[0], en: p[1] }));
    const right = out.pairs.map((p, i) => ({ id: flashTok(full.id, "R", i), fa: p[2], en: p[3] }));
    out.matchLeft = shuffleInPlace(left);
    out.matchRight = shuffleInPlace(right);
    delete out.pairs;
  }
  if (Array.isArray(out.items_fa) || Array.isArray(out.items_en)) {
    const n = Math.max((out.items_fa || []).length, (out.items_en || []).length);
    const bank = [];
    for (let i = 0; i < n; i++) {
      bank.push({ id: flashTok(full.id, "O", i), fa: (out.items_fa || [])[i] || "", en: (out.items_en || [])[i] || "" });
    }
    out.orderBank_fa = shuffleInPlace(bank.map((x) => ({ id: x.id, text: x.fa || x.en })));
    out.orderBank_en = shuffleInPlace(bank.map((x) => ({ id: x.id, text: x.en || x.fa })));
    delete out.items_fa; delete out.items_en;
  }
  if (out.kf && typeof out.kf === "object") {
    out.kf = {
      vignette_fa: out.kf.vignette_fa || "",
      vignette_en: out.kf.vignette_en || "",
      items: (Array.isArray(out.kf.items) ? out.kf.items : []).map((it) => {
        const { answer_fa, answer_en, accept_fa, accept_en, correct, ...rest } = it || {};
        return rest;
      }),
    };
  }
  if (Array.isArray(out.steps)) {
    out.steps = out.steps.map((s) => {
      const { answer_fa, answer_en, accept_fa, accept_en, explanation_fa, explanation_en, ...rest } = s || {};
      return rest;
    });
  }
  if (out.hotspot && typeof out.hotspot === "object") {
    out.hotspot = { confirm: out.hotspot.confirm !== false };
  }
  if (out.puzzle && typeof out.puzzle === "object") {
    const pins = Array.isArray(out.puzzle.pins) ? out.puzzle.pins : [];
    const bank = pins.map((p, i) => ({
      id: flashTok(full.id, "P", i),
      fa: p.label_fa || p.label_en || "",
      en: p.label_en || p.label_fa || "",
    }));
    const distFa = arr(out.puzzle.distractors_fa);
    const distEn = arr(out.puzzle.distractors_en);
    const nDist = Math.max(distFa.length, distEn.length);
    for (let i = 0; i < nDist; i++) {
      bank.push({
        id: flashTok(full.id, "D", i),
        fa: distFa[i] || distEn[i] || "",
        en: distEn[i] || distFa[i] || "",
      });
    }
    out.puzzle = {
      imageUrl: out.puzzle.imageUrl || out.imageUrl || "",
      pins: pins.map((p) => ({ x: p.x, y: p.y })),
      bank: shuffleInPlace(bank.filter((b) => b.fa || b.en)),
    };
  }
  if (Array.isArray(out.features)) {
    out.features = out.features.map((f) => {
      const { belongs, ...rest } = f || {};
      return rest;
    });
  }
  return out;
}

export function gradeFlashcard(full, body = {}, opts = {}) {
  const allowLegacy = !!opts.allowLegacy;
  const type = resolveType(full);
  const lang = body.lang === "en" ? "en" : "fa";

  if (type === "hotspot") {
    const x = Number(body.x), y = Number(body.y);
    const hs = full.hotspot || {};
    const hit = Number.isFinite(x) && Number.isFinite(y) && pointHitsHotspot({ x, y }, hs);
    return {
      ok: !!hit,
      pointsFrac: hit ? 1 : 0,
      ...(body.reveal ? {
        reveal: {
          label_fa: hs.label_fa || "",
          label_en: hs.label_en || "",
          hotspot: {
            label_fa: hs.label_fa || "",
            label_en: hs.label_en || "",
            confirm: hs.confirm !== false,
            shape: hs.shape, x: hs.x, y: hs.y, r: hs.r, w: hs.w, h: hs.h, points: hs.points,
            regions: hs.regions,
          },
        },
      } : {}),
    };
  }
  if (type === "truefalse") {
    const want = !!full.answer;
    const got = coerceTf(body.value ?? body.answer);
    const ok = got !== null && got === want;
    return { ok, pointsFrac: ok ? 1 : 0, ...(body.reveal ? { reveal: { answer: want } } : {}) };
  }
  if (type === "fill") {
    const got = String(body.text ?? body.answer ?? "").trim();
    const accepted = unionAccept(
      lang === "en" ? full.accept_en : full.accept_fa,
      full.blank_fa, full.blank_en,
      lang === "en" ? full.accept_fa : full.accept_en,
    );
    const ok = textMatches(got, accepted);
    return { ok, pointsFrac: ok ? 1 : 0, ...(body.reveal ? { reveal: { fa: full.blank_fa, en: full.blank_en } } : {}) };
  }
  if (type === "match") {
    const pairs = Array.isArray(full.pairs) ? full.pairs : [];
    const got = body.pairs && typeof body.pairs === "object" ? body.pairs : {};
    const keys = Object.keys(got);
    const allNumeric = keys.length > 0 && keys.every((k) => /^\d+$/.test(String(k)));
    let ok = false;
    if (keys.length && !allNumeric) {
      ok = pairs.length > 0 && pairs.every((_, i) => {
        const L = flashTok(full.id, "L", i);
        const R = flashTok(full.id, "R", i);
        return String(got[L]) === R;
      });
    } else if (allowLegacy && pairs.length && keys.length === pairs.length) {
      ok = pairs.every((_, i) => Number(got[i] ?? got[String(i)]) === i);
    }
    return { ok, pointsFrac: ok ? 1 : 0 };
  }
  if (type === "order") {
    const items = lang === "en" ? (full.items_en || full.items_fa || []) : (full.items_fa || full.items_en || []);
    const ids = Array.isArray(body.order) ? body.order : [];
    const allNumeric = ids.length > 0 && ids.every((id) => /^\d+$/.test(String(id)));
    let ok = false;
    if (ids.length && !allNumeric) {
      ok = items.length > 0 && ids.length === items.length && ids.every((id, i) => tokIndex(full.id, "O", id, items.length) === i);
    } else if (allowLegacy) {
      ok = items.length > 0 && ids.length === items.length && ids.every((v, i) => Number(v) === i);
    }
    return { ok, pointsFrac: ok ? 1 : 0 };
  }
  if (type === "kf") {
    const items = Array.isArray(full.kf?.items) ? full.kf.items : [];
    const answers = body.answers && typeof body.answers === "object" ? body.answers : {};
    const results = items.map((it, i) => {
      const got = answers[i] ?? answers[String(i)];
      const base = { index: i + 1, answer: got, correct: false };
      if ((it.kind || "short") === "mcq") {
        const want = Number(it.correct || 0);
        const ok = Number(got) === want;
        return {
          ...base,
          correct: ok,
          ...(body.reveal ? { expected: want } : {}),
        };
      }
      const accepted = unionAccept(
        lang === "en" ? it.accept_en : it.accept_fa,
        it.answer_fa, it.answer_en,
        lang === "en" ? it.accept_fa : it.accept_en,
      );
      const ok = textMatches(got, accepted);
      return {
        ...base,
        correct: ok,
        ...(body.reveal ? { expected: (lang === "en" ? (it.answer_en || it.answer_fa) : (it.answer_fa || it.answer_en)) || accepted[0] || "" } : {}),
      };
    });
    const n = results.length || 1;
    const hits = results.filter((r) => r.correct).length;
    return { ok: hits === n && results.length > 0, pointsFrac: hits / n, kfResults: results };
  }
  if (type === "stepwise") {
    const steps = Array.isArray(full.steps) ? full.steps : [];
    const answers = body.answers && typeof body.answers === "object" ? body.answers : {};
    const results = steps.map((s, i) => {
      const got = String(answers[i] ?? answers[String(i)] ?? "").trim();
      const accepted = unionAccept(
        lang === "en" ? (s.accept_en || s.answer_en) : (s.accept_fa || s.answer_fa),
        s.answer_fa, s.answer_en,
        lang === "en" ? s.accept_fa : s.accept_en,
      );
      const ok = textMatches(got, accepted);
      return {
        index: i + 1,
        correct: ok,
        ...(body.reveal ? { expected: (lang === "en" ? (s.answer_en || s.answer_fa) : (s.answer_fa || s.answer_en)) || accepted[0] || "" } : {}),
      };
    });
    const n = results.length || 1;
    const hits = results.filter((r) => r.correct).length;
    return { ok: hits === n && results.length > 0, pointsFrac: hits / n, stepResults: results };
  }
  if (type === "puzzle") {
    const pins = Array.isArray(full.puzzle?.pins) ? full.puzzle.pins : [];
    const assign = body.assign && typeof body.assign === "object" ? body.assign : {};
    const pinResults = pins.map((p, i) => {
      const got = assign[i] ?? assign[String(i)];
      const legacyOk = allowLegacy && (got === `p${i}` || Number(got) === i);
      const ok = tokIndex(full.id, "P", got, pins.length) === i || legacyOk;
      return { i, ok, ...(body.reveal ? { expected: lang === "en" ? (p.label_en || p.label_fa) : (p.label_fa || p.label_en) } : {}) };
    });
    const n = pinResults.length || 1;
    const hits = pinResults.filter((r) => r.ok).length;
    return { ok: hits === n && pinResults.length > 0, pointsFrac: hits / n, pinResults };
  }
  if (type === "compare") {
    const features = Array.isArray(full.features) ? full.features : [];
    const answers = body.answers && typeof body.answers === "object" ? body.answers : {};
    const featureResults = features.map((f, i) => {
      const got = String(answers[i] ?? answers[String(i)] ?? "").toLowerCase();
      const want = String(f.belongs || "").toLowerCase();
      const ok = !!want && got === want;
      return { i, ok, ...(body.reveal ? { belongs: f.belongs } : {}) };
    });
    const n = featureResults.length || 1;
    const hits = featureResults.filter((r) => r.ok).length;
    return { ok: hits === n && featureResults.length > 0, pointsFrac: hits / n, featureResults };
  }
  if (type === "drawing") {
    return { ok: true, pointsFrac: 0, pendingApproval: true };
  }
  const optsList = Array.isArray(full.options) ? full.options : [];
  const idx = Number(body.optionIndex);
  const ok = Number.isInteger(idx) && idx >= 0 && idx < optsList.length && !!optsList[idx]?.correct;
  const correctIdx = optsList.findIndex((o) => o.correct);
  return { ok, pointsFrac: ok ? 1 : 0, ...(body.reveal ? { reveal: { index: correctIdx } } : {}) };
}

/** Map competitive-player `sel` (Lesson / CustomTest / Review) onto the
 *  university `gradeFlashcard` body. serializeCard uses positional ids for
 *  match/order/compare, so callers must pass `{ allowLegacy: true }`. */
export function bodyFromClientSel(full, raw = {}) {
  const t = resolveType(full);
  const sel = raw.sel;
  const lang = raw.lang === "en" ? "en" : "fa";
  if (t === "mcq") return { optionIndex: raw.optionIndex ?? sel, lang };
  if (t === "truefalse") return { value: raw.value ?? sel ?? raw.answer, lang };
  if (t === "fill") {
    const text = raw.text ?? (typeof sel === "string" || typeof sel === "number" ? String(sel) : "");
    return { text, lang };
  }
  if (t === "match") {
    const pairs = raw.pairs || (sel && typeof sel === "object" && !Array.isArray(sel) && sel.pairs) || sel || {};
    return { pairs, lang };
  }
  if (t === "order") {
    const rawOrder = raw.order || sel;
    const ids = Array.isArray(rawOrder) ? rawOrder.map((x) => (x && typeof x === "object" ? x.id : x)) : [];
    return { order: ids, lang };
  }
  if (t === "compare" || t === "kf" || t === "stepwise") return { answers: raw.answers || sel, lang };
  if (t === "puzzle") return { assign: raw.assign || sel, lang };
  if (t === "hotspot") {
    const pt = sel && typeof sel === "object" ? sel : {};
    return { x: raw.x ?? pt.x, y: raw.y ?? pt.y, lang };
  }
  return { optionIndex: raw.optionIndex ?? sel, lang };
}

export function bodyFromAnswer(a, full = {}) {
  const t = resolveType({ type: a?.type || full.type });
  if (t === "mcq") return { optionIndex: a.selectedIdx ?? a.selected?.[0]?.index };
  if (t === "truefalse") return { value: a.answer };
  if (t === "fill") return { text: a.answer, lang: a.lang };
  if (t === "match") return { pairs: a.pairs || a.answer?.pairs || a.answer };
  if (t === "order") {
    const raw = Array.isArray(a.orderIds) ? a.orderIds
      : (Array.isArray(a.order) ? a.order : a.answer);
    const ids = Array.isArray(raw)
      ? raw.map((x) => (x && typeof x === "object" ? x.id : x))
      : [];
    return { order: ids, lang: a.lang };
  }
  if (t === "hotspot") {
    const last = Array.isArray(a.hotspotClicks) ? a.hotspotClicks[a.hotspotClicks.length - 1] : null;
    return { x: last?.x, y: last?.y };
  }
  if (t === "kf") return { answers: Object.fromEntries((a.kfResults || []).map((r, i) => [i, r.answer])), lang: a.lang };
  if (t === "stepwise") return { answers: Object.fromEntries((a.stepResults || []).map((r, i) => [i, r.answer])), lang: a.lang };
  if (t === "puzzle") return { assign: a.assign || a.answer };
  if (t === "compare") return { answers: a.answers || a.answer, lang: a.lang };
  if (t === "drawing") return {};
  return { optionIndex: a.selectedIdx ?? a.selected?.[0]?.index };
}

function pointsFracOf(g) {
  if (!g) return 0;
  if (g.pointsFrac == null) return g.ok ? 1 : 0;
  const n = Number(g.pointsFrac);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function gradeSubmittedDeck(load, rows, expectedIds) {
  const list = Array.isArray(rows) ? rows : [];
  const seen = new Set();
  const byId = new Map();
  for (const a of list) {
    const id = Number(a?.card_id ?? a?.cardId ?? a?.id);
    if (!Number.isFinite(id) || id <= 0) continue;
    if (seen.has(id)) return { error: "duplicate_card" };
    seen.add(id);
    byId.set(id, a);
  }
  const expected = Array.isArray(expectedIds)
    ? expectedIds.map(Number).filter((n) => Number.isFinite(n) && n > 0)
    : null;
  if (expected) {
    const allowed = new Set(expected);
    for (const id of seen) {
      if (!allowed.has(id)) return { error: "answers_out_of_deck" };
    }
    if (!expected.length) return { score: 0 };
    let sum = 0;
    for (const id of expected) {
      const full = typeof load === "function" ? load(id) : null;
      if (!full) continue;
      const a = byId.get(id);
      if (!a) continue;
      const g = gradeFlashcard(full, bodyFromAnswer(a, full), { allowLegacy: false });
      sum += pointsFracOf(g);
    }
    return { score: Math.round((sum / expected.length) * 100) };
  }
  let sum = 0, n = 0;
  for (const a of list) {
    const id = Number(a?.card_id ?? a?.cardId ?? a?.id);
    if (!Number.isFinite(id)) continue;
    const full = typeof load === "function" ? load(id) : null;
    if (!full) continue;
    const g = gradeFlashcard(full, bodyFromAnswer(a, full), { allowLegacy: false });
    sum += pointsFracOf(g);
    n++;
  }
  if (!n) return { score: null };
  return { score: Math.round((sum / n) * 100) };
}

/* Number of hints a card offers, across both languages (they normally mirror
   each other; max() keeps a partially translated card honest). Used to mirror
   the client-side hint-penalty unit 1/(hints+1) on the server. */
export function hintCountOf(card) {
  const c = (x) => (Array.isArray(x) ? x.filter((v) => v != null && String(v).trim() !== "").length : 0);
  return Math.max(c(card?.hints_fa), c(card?.hints_en), c(card?.hints));
}

/* Grade a submitted deck like gradeSubmittedDeck(), but return per-card detail
   and apply the "no-penalty" policy:
     • baseScore  — pure correctness, hints ignored (used when noPenalty = true)
     • score      — when noPenalty = false (strict), each hinted card loses
                    hintsUsed × (1/(h+1)) of its equal share — the same formula
                    the client uses for its live points display. Wrong parts of
                    multi-part cards (stepwise/kf/...) already forfeit their
                    share via pointsFracOf(), which never goes below zero. */
export function gradeSubmittedDeckDetailed(load, rows, expectedIds, { noPenalty = false } = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const seen = new Set();
  const byId = new Map();
  for (const a of list) {
    const id = Number(a?.card_id ?? a?.cardId ?? a?.id);
    if (!Number.isFinite(id) || id <= 0) continue;
    if (seen.has(id)) return { error: "duplicate_card" };
    seen.add(id);
    byId.set(id, a);
  }
  const expected = Array.isArray(expectedIds)
    ? expectedIds.map(Number).filter((n) => Number.isFinite(n) && n > 0)
    : null;
  if (expected) {
    const allowed = new Set(expected);
    for (const id of seen) if (!allowed.has(id)) return { error: "answers_out_of_deck" };
    if (!expected.length) return { score: 0, baseScore: 0, parts: [] };
    const parts = [];
    for (const id of expected) {
      const full = typeof load === "function" ? load(id) : null;
      const a = byId.get(id);
      if (!full || !a) { parts.push({ id, frac: 0, hintsUsed: 0, hintCount: full ? hintCountOf(full) : 0 }); continue; }
      const g = gradeFlashcard(full, bodyFromAnswer(a, full), { allowLegacy: false });
      const hintsUsed = Math.max(0, Number(a.hintLevel ?? a.hintsUsed) || 0);
      parts.push({ id, frac: pointsFracOf(g), hintsUsed, hintCount: hintCountOf(full) });
    }
    return {
      parts,
      score: deckPenaltyScore(parts, noPenalty),
      baseScore: Math.round((parts.reduce((s, p) => s + p.frac, 0) / expected.length) * 100),
    };
  }
  const parts = [];
  for (const a of list) {
    const id = Number(a?.card_id ?? a?.cardId ?? a?.id);
    if (!Number.isFinite(id)) continue;
    const full = typeof load === "function" ? load(id) : null;
    if (!full) continue;
    const g = gradeFlashcard(full, bodyFromAnswer(a, full), { allowLegacy: false });
    const hintsUsed = Math.max(0, Number(a.hintLevel ?? a.hintsUsed) || 0);
    parts.push({ id, frac: pointsFracOf(g), hintsUsed, hintCount: hintCountOf(full) });
  }
  if (!parts.length) return { score: null, baseScore: null, parts: [] };
  return {
    parts,
    score: deckPenaltyScore(parts, noPenalty),
    baseScore: Math.round((parts.reduce((s, p) => s + p.frac, 0) / parts.length) * 100),
  };
}

function deckPenaltyScore(parts, noPenalty) {
  const n = parts.length;
  if (!n) return 0;
  let sum = 0;
  for (const p of parts) {
    let f = p.frac;
    if (!noPenalty && p.hintCount > 0 && p.hintsUsed > 0) {
      f = Math.max(0, f - (p.hintsUsed / (p.hintCount + 1)));
    }
    sum += f;
  }
  return Math.round((sum / n) * 100);
}

export function scoreSubmittedAnswers(load, rows) {
  const r = gradeSubmittedDeck(load, rows, null);
  return r.error ? null : r.score;
}

/** Human-readable student answer for the classroom live board / teacher drill-down. */
export function formatFlashAnswer(ans, fa = true) {
  const t = String(ans?.type || "mcq").toLowerCase();
  const yes = fa ? "درست" : "True";
  const no = fa ? "نادرست" : "False";
  const both = fa ? "هر دو" : "Both";
  const join = fa ? "، " : ", ";
  if (t === "truefalse") {
    const v = ans.answer ?? ans.value;
    if (v === true || v === "true" || v === 1 || v === "1") return yes;
    if (v === false || v === "false" || v === 0 || v === "0") return no;
    return "—";
  }
  if (t === "fill") {
    const text = ans.answer != null && typeof ans.answer !== "object" ? ans.answer : (ans.text || "");
    return String(text || "").trim() || "—";
  }
  if (t === "match") {
    const pairs = ans.pairs || ans.answer?.pairs || {};
    const n = pairs && typeof pairs === "object" ? Object.keys(pairs).length : 0;
    return n ? (fa ? `${n} جفت` : `${n} pairs`) : "—";
  }
  if (t === "order") {
    const raw = Array.isArray(ans.orderIds) ? ans.orderIds
      : (Array.isArray(ans.order) ? ans.order : (Array.isArray(ans.answer) ? ans.answer : []));
    if (!raw.length) return "—";
    return raw.map((x) => (x && typeof x === "object" ? (x.text || x.id) : x)).join(" → ");
  }
  if (t === "compare") {
    const a = ans.answers && typeof ans.answers === "object" ? ans.answers : {};
    const vals = Object.values(a);
    if (!vals.length) return "—";
    return vals.map((v) => (v === "both" ? both : String(v))).join(join);
  }
  if (t === "kf") {
    const rows = Array.isArray(ans.kfResults) ? ans.kfResults : [];
    if (!rows.length) return "—";
    return rows.map((s) => `${s.index || ""}. ${s.answer ?? "—"} ${s.correct ? "✓" : "✗"}`.trim()).join(" | ");
  }
  if (t === "stepwise") {
    const rows = Array.isArray(ans.stepResults) ? ans.stepResults : [];
    if (!rows.length) return "—";
    return rows.map((s) => `${s.index || ""}. ${s.answer || "—"} ${s.correct ? "✓" : "✗"}`.trim()).join(" | ");
  }
  if (t === "puzzle") {
    const assign = ans.assign && typeof ans.assign === "object" ? ans.assign : {};
    const n = Object.keys(assign).length;
    return n ? (fa ? `${n} برچسب` : `${n} labels`) : "—";
  }
  if (t === "hotspot") {
    const last = Array.isArray(ans.hotspotClicks) ? ans.hotspotClicks[ans.hotspotClicks.length - 1] : null;
    if (!last || last.x == null) return "—";
    return `(${last.x}, ${last.y})${last.ok ? " ✓" : " ✗"}`;
  }
  if (t === "drawing") return fa ? "نقاشی ثبت شده" : "Drawing submitted";
  if (Array.isArray(ans.selected) && ans.selected.length) {
    return ans.selected.map((x) => (fa ? (x.fa || x.en) : (x.en || x.fa))).filter(Boolean).join(join) || "—";
  }
  if (ans.answer != null && typeof ans.answer !== "object") return String(ans.answer);
  return "—";
}
