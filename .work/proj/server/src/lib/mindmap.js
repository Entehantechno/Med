/* mindmap.js — build a hierarchical MIND-MAP for a topic, entirely from the
   hand-written درسنامه (micro) content already stored on each card. NO AI:
   the map is a deterministic transformation of existing lesson material, so it
   costs nothing to generate and always reflects exactly what teachers wrote.

   Shape:
   {
     topic: { slug, title, emoji },
     branches: [
       { lesson: "…", children: [
           { label: "نکته طلایی: …", kind: "golden" },
           { label: "…point…",       kind: "point"  },
       ] },
     ]
   }
*/
import { db } from "../db.js";
import { emojiForTopic } from "./topicemoji.js";
import { serializeCard } from "./cardserialize.js";
import { microValue } from "./lesson-translate.js";

export function buildMindmap(topicSlug, lang = "fa") {
  const topic = db.prepare("SELECT * FROM topics WHERE slug=?").get(topicSlug);
  if (!topic) return null;
  const nodes = db.prepare(
    "SELECT * FROM path_nodes WHERE topic_id=? AND active=1 ORDER BY ord"
  ).all(topic.id);

  const branches = [];
  for (const n of nodes) {
    let ids = []; try { ids = JSON.parse(n.card_ids || "[]"); } catch { /* */ }
    const children = [];
    for (const cid of ids) {
      const card = db.prepare("SELECT id, public_code, difficulty, data_json FROM flashcards WHERE id=? AND active=1").get(cid);
      if (!card) continue;
      // Same serializer as the lesson page: only the site language is shown.
      // A golden tip or point missing in this language is `pending` (the client
      // fills it from the translation of this card), never the other language.
      const micro = serializeCard(card, lang)?.micro;
      if (!micro) continue;
      const pend = micro.pending;
      const pf = pend ? pend.fields : [];
      if (pf.includes("golden")) children.push({ label: null, kind: "golden", pending: true, cardId: cid, field: "golden", to: pend.to, hash: pend.hash });
      else if (micro.golden) children.push({ label: micro.golden, kind: "golden" });
      if (pf.includes("points")) {
        let d = {}; try { d = JSON.parse(card.data_json); } catch { d = {}; }
        const srcCount = microValue(d.micro || {}, "points", pend.from).length;
        for (let i = 0; i < srcCount; i++) children.push({ label: null, kind: "point", pending: true, cardId: cid, field: "points", index: i, to: pend.to, hash: pend.hash });
      } else {
        for (const p of micro.points || []) if (p) children.push({ label: p, kind: "point" });
      }
    }
    // de-duplicate identical labels within a lesson to keep the map clean
    const seen = new Set();
    const uniq = children.filter((c) => {
      const k = c.pending ? `pending|${c.cardId}|${c.field}|${c.index ?? ""}` : c.kind + "|" + c.label;
      if (seen.has(k)) return false; seen.add(k); return true;
    });
    if (uniq.length) {
      branches.push({
        lesson: lang === "fa" ? (n.title_fa || n.title_en) : (n.title_en || n.title_fa),
        emoji: n.emoji || "",
        children: uniq.slice(0, 8), // keep each lesson branch readable
      });
    }
  }

  return {
    topic: {
      slug: topic.slug,
      title: lang === "fa" ? (topic.name_fa || topic.name_en) : (topic.name_en || topic.name_fa),
      emoji: topic.emoji || emojiForTopic(topic.slug),
      color: topic.color || "#2f7fd1",
    },
    branches,
    empty: branches.length === 0,
  };
}

// list topics that HAVE mind-map-able content (at least one golden/point),
// scoped to a program (Duolingo-style course) when provided.
export function mindmapTopics(lang = "fa", program = null) {
  const topics = program
    ? db.prepare("SELECT * FROM topics WHERE active=1 AND program=? ORDER BY ord").all(program)
    : db.prepare("SELECT * FROM topics WHERE active=1 ORDER BY ord").all();
  const out = [];
  for (const t of topics) {
    const map = buildMindmap(t.slug, lang);
    out.push({
      slug: t.slug,
      title: lang === "fa" ? (t.name_fa || t.name_en) : (t.name_en || t.name_fa),
      emoji: t.emoji || emojiForTopic(t.slug),
      color: t.color || "#2f7fd1",
      branches: map ? map.branches.length : 0,
      hasContent: !!(map && !map.empty),
    });
  }
  return out;
}
