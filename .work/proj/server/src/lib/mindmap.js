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

function tx(d, fa, en, lang) {
  return lang === "fa" ? (d[fa] ?? d[en] ?? "") : (d[en] ?? d[fa] ?? "");
}

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
      const card = db.prepare("SELECT data_json FROM flashcards WHERE id=? AND active=1").get(cid);
      if (!card) continue;
      let d = {}; try { d = JSON.parse(card.data_json); } catch { continue; }
      const m = d.micro;
      if (!m) continue;
      const golden = tx(m, "golden_fa", "golden_en", lang);
      if (golden) children.push({ label: golden, kind: "golden" });
      const points = (lang === "fa" ? m.points_fa : m.points_en) || [];
      for (const p of points) if (p) children.push({ label: p, kind: "point" });
    }
    // de-duplicate identical labels within a lesson to keep the map clean
    const seen = new Set();
    const uniq = children.filter((c) => { const k = c.kind + "|" + c.label; if (seen.has(k)) return false; seen.add(k); return true; });
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
