/* Build a short chapter recap from the golden tips already authored
   on the cards of a lesson / topic. No AI — just the teaching points
   the student already earned, compressed. */

import { db } from "../db.js";
import { stripCrossRefs } from "./lessontext.js";
import { serializeCard } from "./cardserialize.js";

function parse(row) {
  try { return JSON.parse(row.data_json || "{}"); } catch { return {}; }
}

function uniq(list) {
  const seen = new Set();
  const out = [];
  for (const x of list) {
    const k = String(x || "").replace(/\s+/g, " ").trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(String(x).trim());
  }
  return out;
}

/* One summary item per card, in lesson order. A card whose golden tip / lead /
   first point exists in the site language gives a native text. A card whose
   text is missing in the site language gives `text: null` and a `pending`
   translation request (the client fills it from the browser cache or AI).
   Built from serializeCard, so the pending hash is the same one the translation
   endpoint verifies. */
export function summaryItemsFromCards(cards, lang = "fa") {
  const items = [];
  for (const c of cards) {
    const raw = c.data_json ?? JSON.stringify(c.data || {});
    const s = serializeCard({ id: c.id, public_code: c.public_code, difficulty: c.difficulty, data_json: raw }, lang);
    const micro = s?.micro;
    if (!micro) continue;
    const pend = micro.pending || null;
    const pendFields = pend ? pend.fields : [];
    const order = [["golden", "golden"], ["lead", "lead"], ["points0", "points"]];
    let item = { cardId: c.id, field: null, text: null, pending: null };
    for (const [kind, key] of order) {
      if (pendFields.includes(key)) { item = { cardId: c.id, field: kind, text: null, pending: pend }; break; }
      const native = key === "points" ? (micro.points || [])[0] : micro[key];
      if (native && String(native).trim()) { item = { cardId: c.id, field: kind, text: stripCrossRefs(native), pending: null }; break; }
    }
    if (item.field || item.pending) items.push(item);
  }
  return items;
}

/* Native bullets only (for the non-pending part of a summary). */
export function bulletsOf(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    if (!it.text) continue;
    const k = it.text.replace(/\s+/g, " ").trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(it.text.trim());
  }
  return out.slice(0, 12);
}

export function summaryFromCards(cards, lang = "fa") {
  return bulletsOf(summaryItemsFromCards(cards, lang));
}

export function lessonSummary(nodeId, lang = "fa") {
  const node = db.prepare("SELECT * FROM path_nodes WHERE id=?").get(nodeId);
  if (!node) return null;
  const topic = db.prepare("SELECT * FROM topics WHERE id=?").get(node.topic_id);
  let ids = [];
  try { ids = JSON.parse(node.card_ids || "[]"); } catch { ids = []; }
  const cards = ids.map((id) => db.prepare("SELECT id, data_json FROM flashcards WHERE id=? AND active=1").get(id)).filter(Boolean);
  const items = summaryItemsFromCards(cards, lang);
  const bullets = bulletsOf(items);
  return {
    nodeId: node.id,
    topicId: topic?.id || null,
    topicSlug: topic?.slug || "",
    title: lang === "fa" ? (node.title_fa || topic?.name_fa) : (node.title_en || topic?.name_en),
    topicName: lang === "fa" ? topic?.name_fa : topic?.name_en,
    bullets,
    items,
    pendingCount: items.filter((it) => it.pending).length,
    count: bullets.length,
  };
}

export function topicSummaries(topicId, lang = "fa") {
  const topic = db.prepare("SELECT * FROM topics WHERE id=? AND active=1").get(topicId);
  if (!topic) return null;
  const nodes = db.prepare("SELECT * FROM path_nodes WHERE topic_id=? AND active=1 ORDER BY ord, id").all(topicId);
  const chapters = nodes.map((n) => lessonSummary(n.id, lang)).filter((s) => s && (s.count || s.pendingCount));
  return {
    topicId: topic.id,
    slug: topic.slug,
    name: lang === "fa" ? topic.name_fa : topic.name_en,
    chapters,
  };
}

export function programSummaries(program, lang = "fa") {
  const topics = db.prepare("SELECT * FROM topics WHERE active=1 AND program=? ORDER BY ord, id").all(program);
  return topics.map((t) => topicSummaries(t.id, lang)).filter(Boolean);
}
