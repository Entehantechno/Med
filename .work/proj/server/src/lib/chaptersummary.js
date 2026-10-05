/* Build a short chapter recap from the golden tips already authored
   on the cards of a lesson / topic. No AI — just the teaching points
   the student already earned, compressed. */

import { db } from "../db.js";
import { stripCrossRefs } from "./lessontext.js";

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

export function summaryFromCards(cards, lang = "fa") {
  const bullets = [];
  for (const c of cards) {
    const d = c.data || parse(c);
    const m = d.micro || {};
    const golden = lang === "fa" ? (m.golden_fa || m.golden_en) : (m.golden_en || m.golden_fa);
    const lead = lang === "fa" ? (m.lead_fa || m.lead_en) : (m.lead_en || m.lead_fa);
    const pts = (lang === "fa" ? m.points_fa : m.points_en) || [];
    if (golden) bullets.push(stripCrossRefs(golden));
    else if (lead) bullets.push(stripCrossRefs(lead));
    else if (pts[0]) bullets.push(stripCrossRefs(pts[0]));
  }
  return uniq(bullets).slice(0, 12);
}

export function lessonSummary(nodeId, lang = "fa") {
  const node = db.prepare("SELECT * FROM path_nodes WHERE id=?").get(nodeId);
  if (!node) return null;
  const topic = db.prepare("SELECT * FROM topics WHERE id=?").get(node.topic_id);
  let ids = [];
  try { ids = JSON.parse(node.card_ids || "[]"); } catch { ids = []; }
  const cards = ids.map((id) => db.prepare("SELECT id, data_json FROM flashcards WHERE id=? AND active=1").get(id)).filter(Boolean);
  const bullets = summaryFromCards(cards, lang);
  return {
    nodeId: node.id,
    topicId: topic?.id || null,
    topicSlug: topic?.slug || "",
    title: lang === "fa" ? (node.title_fa || topic?.name_fa) : (node.title_en || topic?.name_en),
    topicName: lang === "fa" ? topic?.name_fa : topic?.name_en,
    bullets,
    count: bullets.length,
  };
}

export function topicSummaries(topicId, lang = "fa") {
  const topic = db.prepare("SELECT * FROM topics WHERE id=? AND active=1").get(topicId);
  if (!topic) return null;
  const nodes = db.prepare("SELECT * FROM path_nodes WHERE topic_id=? AND active=1 ORDER BY ord, id").all(topicId);
  const chapters = nodes.map((n) => lessonSummary(n.id, lang)).filter((s) => s && s.count);
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
