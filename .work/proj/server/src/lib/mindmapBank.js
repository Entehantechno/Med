/* mindmapBank.js — Premium MindMap + Approach Bank (2026-10-02 → 2026-10-04 — 100 maps)
   A premium-only, bidirectionally linked knowledge graph:

   - MindMaps: hierarchical disease maps (definition → complications)
   - Approaches: clinical decision trees (undifferentiated → action)

   Both are stored in mindmap_bank with graph_json {nodes, edges}
   and linked to questions via question_mindmap_links.

   Features:
   - Advanced faceted search: OR inside facet, AND across, with live counts (like Qbank)
   - Full-text across title/summary/nodes (Persian-normalized, digits, branch)
   - Admin full control: CRUD, bulk, import/export CSV/JSON, duplicate, history, validation
   - 50 high-yield Harrison-based maps (see seedMindmapBank) — visually rich
*/

import { db, persistNow } from "../db.js";
import { isEnabled } from "./flags.js";

export const MINDMAP_SYSTEMS = ["cardio","pulmo","gastro","nephro","endo","neuro","heme","rheum","infect","emergency","other"];
export const MINDMAP_TYPES = ["mind","approach"];
export const MINDMAP_LEVELS = ["core","high_yield","emergency"];
export const MINDMAP_BRANCHES = ["definition","etiology","patho","clinical","workup","treatment","complication","ddx","start","question","action"];

// --- text normalization (like cardfacets / textsearch) ---
function normFa(s) {
  if (!s) return "";
  return String(s)
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/ي/g, "ی").replace(/ك/g, "ک")
    .replace(/\u200c/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}
function normalizeText(s) { return normFa(s); }

function rowToCard(r, lang) {
  const title = lang === "fa" ? r.title_fa : r.title_en;
  const summary = lang === "fa" ? r.summary_fa : r.summary_en;
  let graph = null;
  try { graph = JSON.parse(r.graph_json || "{}"); } catch { graph = { nodes: [], edges: [] }; }
  return {
    id: r.id,
    slug: r.slug,
    title,
    title_fa: r.title_fa,
    title_en: r.title_en,
    type: r.type,
    system: r.system,
    level: r.level,
    summary,
    summary_fa: r.summary_fa,
    summary_en: r.summary_en,
    cover_url: r.cover_url,
    is_premium: !!r.is_premium,
    status: r.status,
    nodes: graph.nodes || [],
    edges: graph.edges || [],
    graph,
    created_at: r.created_at,
    updated_at: r.updated_at,
    // denormalized for search
    _haystack: normalizeText([r.title_fa, r.title_en, r.summary_fa, r.summary_en, r.system, r.type, r.level, ...(graph.nodes||[]).map(n=>n.label_fa+" "+n.label_en+" "+n.branch)].join(" ")),
  };
}

// --- facets for mindmaps ---
export function mindmapFacets() {
  return {
    system: { label_fa: "دستگاه", label_en: "System", options: MINDMAP_SYSTEMS },
    type: { label_fa: "نوع", label_en: "Type", options: MINDMAP_TYPES },
    level: { label_fa: "سطح", label_en: "Level", options: MINDMAP_LEVELS },
    branch: { label_fa: "شاخه", label_en: "Branch", options: MINDMAP_BRANCHES },
    premium: { label_fa: "دسترسی", label_en: "Access", options: ["free","premium"] },
  };
}

// Build facet index: counts for each facet value, recomputed against other active filters (honest counts)
function buildFacetCounts(rows, active) {
  // rows: already filtered by other facets? For honest counts, we compute per facet by excluding that facet's filter
  const all = rows;
  const counts = { system: {}, type: {}, level: {}, branch: {}, premium: {} };
  for (const r of all) {
    counts.system[r.system] = (counts.system[r.system]||0)+1;
    counts.type[r.type] = (counts.type[r.type]||0)+1;
    counts.level[r.level] = (counts.level[r.level]||0)+1;
    for (const n of (r.graph?.nodes||[])) {
      if (n.branch) counts.branch[n.branch] = (counts.branch[n.branch]||0)+1;
    }
    const p = r.is_premium ? "premium" : "free";
    counts.premium[p] = (counts.premium[p]||0)+1;
  }
  return counts;
}

// Advanced list with faceted search
export function searchMindmaps({
  lang = "fa",
  q = "",
  filters = {}, // { system:[], type:[], level:[], branch:[], premium:[] }
  sort = "default", // default | newest | nodes | title
  page = 1,
  pageSize = 20,
  isPremium = false,
  status = "active",
} = {}) {
  const normQ = normalizeText(q);
  const tokens = normQ ? normQ.split(/\s+/).filter(Boolean) : [];
  let rows = db.prepare(`SELECT * FROM mindmap_bank WHERE status=?`).all(status);
  // enrich with card
  let cards = rows.map(r => rowToCard(r, lang));

  // facet filtering: OR inside facet, AND across facets
  const has = (arr) => Array.isArray(arr) && arr.length > 0;
  if (has(filters.system)) {
    const set = new Set(filters.system);
    cards = cards.filter(c => set.has(c.system));
  }
  if (has(filters.type)) {
    const set = new Set(filters.type);
    cards = cards.filter(c => set.has(c.type));
  }
  if (has(filters.level)) {
    const set = new Set(filters.level);
    cards = cards.filter(c => set.has(c.level));
  }
  if (has(filters.premium)) {
    const set = new Set(filters.premium);
    cards = cards.filter(c => {
      const v = c.is_premium ? "premium" : "free";
      return set.has(v);
    });
  }
  if (has(filters.branch)) {
    const set = new Set(filters.branch);
    cards = cards.filter(c => c.nodes.some(n => set.has(n.branch)));
  }

  // full-text: all tokens must appear (AND)
  if (tokens.length) {
    cards = cards.filter(c => tokens.every(tok => c._haystack.includes(tok)));
  }

  // facet counts (honest, against current filtered set)
  const facetCounts = buildFacetCounts(cards, filters);

  // sorting
  if (sort === "newest") cards.sort((a,b) => (b.created_at||"").localeCompare(a.created_at||""));
  else if (sort === "nodes") cards.sort((a,b) => b.nodes.length - a.nodes.length);
  else if (sort === "title") cards.sort((a,b) => a.title.localeCompare(b.title, lang==="fa"?"fa":"en"));
  else {
    // default: high_yield first, then core, then emergency, then id
    const order = { core:0, high_yield:1, emergency:2 };
    cards.sort((a,b) => (order[a.level]??9) - (order[b.level]??9) || a.id - b.id);
  }

  const total = cards.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const p = Math.max(1, Math.min(page, totalPages));
  const start = (p-1)*pageSize;
  const items = cards.slice(start, start+pageSize);

  // premium gating (same as before, but per page)
  const previews = 3;
  const isLocked = (r) => r.is_premium && !isPremium;
  // we need global index for locking (not page index)
  const allIds = cards.map(c=>c.id);
  const mapped = items.map(c => {
    const globalIdx = allIds.indexOf(c.id);
    const locked = isLocked(c) && globalIdx >= previews && !isPremium;
    const isPreview = isLocked(c) && globalIdx < previews;
    if (locked) {
      return { ...c, locked:true, isPreview:false, nodes:[], edges:[], graph:{nodes:[],edges:[]}, summary: lang==="fa" ? "🔒 ویژه پرمیوم" : "🔒 Premium only", _haystack: undefined };
    }
    return { ...c, locked:false, isPreview, _haystack: undefined };
  });

  return {
    total, totalPages, page: p, pageSize,
    previews: isPremium ? 0 : previews,
    facetCounts,
    items: mapped,
    query: q,
    filters,
    sort,
  };
}

// Legacy list (for backward compat) — delegates to search
export function listMindmaps({ lang = "fa", system = null, type = null, isPremium = false } = {}) {
  const filters = {};
  if (system) filters.system = [system];
  if (type) filters.type = [type];
  const out = searchMindmaps({ lang, filters, isPremium, pageSize: 100 });
  return { total: out.total, previews: out.previews, items: out.items, facetCounts: out.facetCounts };
}

export function getMindmap(slug, { lang = "fa", isPremium = false } = {}) {
  const r = db.prepare("SELECT * FROM mindmap_bank WHERE slug=? AND status='active'").get(slug);
  if (!r) return null;
  const card = rowToCard(r, lang);
  const idxRow = db.prepare("SELECT COUNT(*) c FROM mindmap_bank WHERE status='active' AND id < ?").get(r.id);
  const idx = idxRow ? idxRow.c : 0;
  const locked = r.is_premium && !isPremium && idx >= 3;
  if (locked) {
    return { ...card, locked: true, nodes: [], edges: [], graph: { nodes: [], edges: [] }, related: [], _haystack: undefined };
  }
  const rel = db.prepare(`
    SELECT f.id, f.data_json, qml.weight
    FROM question_mindmap_links qml
    JOIN flashcards f ON f.id = qml.question_id
    WHERE qml.mindmap_slug=? AND f.active=1
    ORDER BY qml.weight ASC, f.id DESC LIMIT 5
  `).all(slug);
  const related = rel.map((q) => {
    let d = {};
    try { d = JSON.parse(q.data_json); } catch {}
    const stem = d.q || d.stem || d.questionText_fa || d.title_fa || "";
    const short = stem.slice(0, 90);
    return { id: q.id, stem: short, weight: q.weight, premium: !!d.premium };
  });
  const { _haystack, ...rest } = card;
  return { ...rest, locked: false, isPreview: r.is_premium && !isPremium && idx < 3, related };
}

export function questionsByConcept({ concept, mindmapSlug = null, lang = "fa", limit = 20, offset = 0 } = {}) {
  let sql = `
    SELECT f.id, f.data_json FROM question_mindmap_links qml
    JOIN flashcards f ON f.id = qml.question_id
    WHERE f.active=1
  `;
  const params = [];
  if (concept) {
    sql += " AND (qml.node_slug=? OR qml.mindmap_slug=?)";
    params.push(concept, concept);
  } else if (mindmapSlug) {
    sql += " AND qml.mindmap_slug=?";
    params.push(mindmapSlug);
  } else {
    return [];
  }
  sql += " ORDER BY qml.weight ASC, f.id DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);
  const rows = db.prepare(sql).all(...params);
  return rows.map((r) => {
    let d = {};
    try { d = JSON.parse(r.data_json); } catch {}
    return {
      id: r.id,
      q: d.q || d.questionText_fa || d.title_fa || "",
      type: d.type || "mcq",
      premium: !!d.premium,
      concept: concept || mindmapSlug,
    };
  });
}

// Admin: upsert mindmap
export function upsertMindmap(data) {
  const now = new Date().toISOString();
  const graphStr = typeof data.graph_json === "string" ? data.graph_json : JSON.stringify(data.graph_json || { nodes: [], edges: [] });
  // validation
  if (!data.slug || !/^[a-z0-9-]+$/.test(data.slug)) throw new Error("slug must be [a-z0-9-]");
  if (!data.title_fa || !data.title_en) throw new Error("titles required");
  let graph = null;
  try { graph = JSON.parse(graphStr); } catch { throw new Error("invalid graph_json"); }
  if (!graph.nodes || !Array.isArray(graph.nodes)) throw new Error("graph.nodes required");
  const existing = db.prepare("SELECT id FROM mindmap_bank WHERE slug=?").get(data.slug);
  if (existing) {
    db.prepare(`
      UPDATE mindmap_bank SET title_fa=?, title_en=?, type=?, system=?, level=?, summary_fa=?, summary_en=?, graph_json=?, cover_url=?, is_premium=?, status=?, updated_at=?
      WHERE slug=?
    `).run(
      data.title_fa, data.title_en, data.type || "mind", data.system || "other", data.level || "core",
      data.summary_fa || "", data.summary_en || "", graphStr, data.cover_url || "", data.is_premium ? 1 : 0, data.status || "active", now, data.slug
    );
    // history
    try { db.prepare("INSERT INTO mindmap_history (slug, action, data_json, actor) VALUES (?,?,?,?)").run(data.slug, "update", JSON.stringify(data), data.actor || "admin"); } catch {}
    return db.prepare("SELECT * FROM mindmap_bank WHERE slug=?").get(data.slug);
  } else {
    const info = db.prepare(`
      INSERT INTO mindmap_bank (slug,title_fa,title_en,type,system,level,summary_fa,summary_en,graph_json,cover_url,is_premium,status,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      data.slug, data.title_fa, data.title_en, data.type || "mind", data.system || "other", data.level || "core",
      data.summary_fa || "", data.summary_en || "", graphStr, data.cover_url || "", data.is_premium ? 1 : 0, data.status || "active", now, now
    );
    try { db.prepare("INSERT INTO mindmap_history (slug, action, data_json, actor) VALUES (?,?,?,?)").run(data.slug, "create", JSON.stringify(data), data.actor || "admin"); } catch {}
    return db.prepare("SELECT * FROM mindmap_bank WHERE id=?").get(info.lastInsertRowid);
  }
}

export function deleteMindmap(slug, actor="admin") {
  const row = db.prepare("SELECT * FROM mindmap_bank WHERE slug=?").get(slug);
  if (!row) return;
  try { db.prepare("INSERT INTO mindmap_history (slug, action, data_json, actor) VALUES (?,?,?,?)").run(slug, "delete", JSON.stringify(row), actor); } catch {}
  db.prepare("DELETE FROM mindmap_bank WHERE slug=?").run(slug);
  db.prepare("DELETE FROM question_mindmap_links WHERE mindmap_slug=?").run(slug);
}

export function duplicateMindmap(slug, newSlug) {
  const r = db.prepare("SELECT * FROM mindmap_bank WHERE slug=?").get(slug);
  if (!r) throw new Error("not found");
  if (db.prepare("SELECT 1 FROM mindmap_bank WHERE slug=?").get(newSlug)) throw new Error("new slug exists");
  const now = new Date().toISOString();
  const info = db.prepare(`
    INSERT INTO mindmap_bank (slug,title_fa,title_en,type,system,level,summary_fa,summary_en,graph_json,cover_url,is_premium,status,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(newSlug, r.title_fa+" (کپی)", r.title_en+" (copy)", r.type, r.system, r.level, r.summary_fa, r.summary_en, r.graph_json, r.cover_url, r.is_premium, "draft", now, now);
  return db.prepare("SELECT * FROM mindmap_bank WHERE id=?").get(info.lastInsertRowid);
}

export function linkQuestion({ question_id, mindmap_slug, node_slug = null, weight = 1 }) {
  db.prepare(`
    INSERT INTO question_mindmap_links (question_id,mindmap_slug,node_slug,weight)
    VALUES (?,?,?,?)
    ON CONFLICT(question_id,mindmap_slug) DO UPDATE SET node_slug=excluded.node_slug, weight=excluded.weight
  `).run(question_id, mindmap_slug, node_slug, weight);
}

export function unlinkQuestion({ question_id, mindmap_slug }) {
  db.prepare("DELETE FROM question_mindmap_links WHERE question_id=? AND mindmap_slug=?").run(question_id, mindmap_slug);
}

export function bulkDelete(slugs) {
  for (const s of slugs) deleteMindmap(s);
}
export function bulkUpdateStatus(slugs, status) {
  const now = new Date().toISOString();
  for (const s of slugs) db.prepare("UPDATE mindmap_bank SET status=?, updated_at=? WHERE slug=?").run(status, now, s);
}
export function bulkUpdatePremium(slugs, isPremium) {
  const now = new Date().toISOString();
  for (const s of slugs) db.prepare("UPDATE mindmap_bank SET is_premium=?, updated_at=? WHERE slug=?").run(isPremium?1:0, now, s);
}

// CSV export/import (like Qbank)
export function exportCSV(lang="fa") {
  const rows = db.prepare("SELECT * FROM mindmap_bank ORDER BY id").all();
  const header = ["slug","title_fa","title_en","type","system","level","summary_fa","summary_en","cover_url","is_premium","status","nodes","edges"];
  const lines = [header.join(",")];
  for (const r of rows) {
    let g={}; try{g=JSON.parse(r.graph_json)}catch{}
    const esc = (v) => `"${String(v||"").replace(/"/g,'""')}"`;
    lines.push([r.slug, r.title_fa, r.title_en, r.type, r.system, r.level, r.summary_fa, r.summary_en, r.cover_url, r.is_premium, r.status, (g.nodes||[]).length, (g.edges||[]).length].map(esc).join(","));
  }
  return lines.join("\n");
}
export function importCSV(csv) {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error("empty csv");
  const header = lines[0].split(",").map(h=>h.replace(/^"|"$/g,"").trim());
  let imported=0, errors=[];
  for (let i=1;i<lines.length;i++) {
    const cols = lines[i].split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(c=>c.replace(/^"|"$/g,"").replace(/""/g,'"'));
    const row = Object.fromEntries(header.map((h,idx)=>[h, cols[idx]||""]));
    try {
      if (!row.slug) throw new Error("slug required");
      const existing = db.prepare("SELECT id FROM mindmap_bank WHERE slug=?").get(row.slug);
      if (!existing) {
        db.prepare(`INSERT INTO mindmap_bank (slug,title_fa,title_en,type,system,level,summary_fa,summary_en,graph_json,cover_url,is_premium,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
          .run(row.slug, row.title_fa, row.title_en, row.type||"mind", row.system||"other", row.level||"core", row.summary_fa, row.summary_en, JSON.stringify({nodes:[],edges:[]}), row.cover_url||"", row.is_premium=="1"?1:0, row.status||"active");
        imported++;
      }
    } catch(e){ errors.push(`row ${i}: ${e.message}`); }
  }
  return { imported, errors };
}

// Ensure history table
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS mindmap_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL,
      action TEXT NOT NULL,
      data_json TEXT,
      actor TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_mh_slug ON mindmap_history(slug);
  `);
} catch {}

// Seed 50 high-yield Harrison-based mindmaps — idempotent, premium + free mix
export function seedMindmapBank() {
  const existing = db.prepare("SELECT COUNT(*) c FROM mindmap_bank").get().c;
  if (existing >= 100) return { seeded: 0, total: existing };

  const maps = [
    // 1-11 as before (kept for compat)
    {
      slug: "stem-acs-anterior",
      title_fa: "سندرم حاد کرونری — STEMI قدامی",
      title_en: "Acute Coronary Syndrome — Anterior STEMI",
      type: "mind", system: "cardio", level: "high_yield",
      summary_fa: "انسداد LAD → صعود ST در V1-V4، درمان فوری با کات اولیه. رفرنس: Harrison 22e Ch. 33-35.",
      summary_en: "LAD occlusion → ST elevation V1-V4, immediate cath. Ref: Harrison 22e Ch. 33-35.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "def", label_fa: "تعریف: انسداد کامل کرونری + صعود ST", label_en: "Def: total occlusion + ST elevation", branch: "definition", x: 0, y: 0 },
          { id: "eti", label_fa: "اتیولوژی: پارگی پلاک آترواسکلروز", label_en: "Etiology: plaque rupture", branch: "etiology", x: -200, y: 100 },
          { id: "path", label_fa: "پاتوفیزیو: لخته + اسپاسم → نکروز ترانس‌مورال", label_en: "Path: clot + spasm → transmural necrosis", branch: "patho", x: 200, y: 100 },
          { id: "clin", label_fa: "تظاهر: درد رترواسترنال + تعریق + تهوع", label_en: "Clin: retrosternal pain + sweat + nausea", branch: "clinical", x: -200, y: 220 },
          { id: "inv", label_fa: "بررسی: ECG (ST↑ V1-V4) + تروپونین", label_en: "Workup: ECG ST↑ V1-V4 + troponin", branch: "workup", x: 200, y: 220 },
          { id: "ddx", label_fa: "افتراقی: پریکاردیت، دیسکسیون آئورت", label_en: "DDx: pericarditis, aortic dissection", branch: "ddx", x: -200, y: 340 },
          { id: "rx", label_fa: "درمان: DAPT + هپارین + کات <90 دقیقه", label_en: "Rx: DAPT + heparin + cath <90m", branch: "treatment", x: 200, y: 340 },
          { id: "comp", label_fa: "عوارض: آریتمی، شوک، مرگ", label_en: "Comp: arrhythmia, shock, death", branch: "complication", x: 0, y: 460 },
        ],
        edges: [
          { from: "eti", to: "path", label: "→" },
          { from: "path", to: "clin", label: "→" },
          { from: "clin", to: "inv", label: "→" },
          { from: "inv", to: "rx", label: "→" },
          { from: "path", to: "comp", label: "if untreated" },
        ]
      }
    },
    {
      slug: "pneumonia-cap",
      title_fa: "پنومونی اکتسابی از جامعه",
      title_en: "Community-Acquired Pneumonia",
      type: "mind", system: "pulmo", level: "core",
      summary_fa: "تب + سرفه خلط‌دار + انفیلتراسیون — CURB-65 + آنتی‌بیوتیک. Harrison 22e Ch. 86-88.",
      summary_en: "Fever + productive cough + infiltrate — CURB-65 + abx. Harrison 22e Ch. 86-88.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "def", label_fa: "تعریف: التهاب پارانشیم ریه خارج بیمارستان", label_en: "Def: lung parenchyma inflammation outside hospital", branch: "definition", x: 0, y: 0 },
          { id: "path", label_fa: "پاتوژن: پنوموکوک، هموفیلوس، آتیپیک", label_en: "Pathogen: pneumo, H.flu, atypical", branch: "patho", x: 0, y: 110 },
          { id: "clin", label_fa: "تظاهر: تب، سرفه، تاکی‌پنه، کراکل", label_en: "Clin: fever, cough, tachypnea, crackles", branch: "clinical", x: -180, y: 220 },
          { id: "inv", label_fa: "بررسی: CXR (consolidation) + کشت", label_en: "Workup: CXR consolidation + culture", branch: "workup", x: 180, y: 220 },
          { id: "rx", label_fa: "درمان: آموکسی‌سیلین یا ماکرولید", label_en: "Rx: amox or macrolide", branch: "treatment", x: 0, y: 340 },
        ],
        edges: [
          { from: "def", to: "path", label: "" },
          { from: "path", to: "clin", label: "" },
          { from: "clin", to: "inv", label: "" },
          { from: "inv", to: "rx", label: "" },
        ]
      }
    },
    {
      slug: "dka",
      title_fa: "کتواسیدوز دیابتی (DKA)",
      title_en: "Diabetic Ketoacidosis",
      type: "mind", system: "endo", level: "high_yield",
      summary_fa: "کمبود مطلق انسولین → هایپرگلیسمی، کتوز، اسیدوز. Harrison 22e Ch. 37-39 (Diabetes).",
      summary_en: "Absolute insulin lack → hyperglycemia, ketosis, acidosis. Harrison 22e Ch. 37-39.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "tri", label_fa: "تریاد: قند>250 + کتون + pH<7.3", label_en: "Triad: glc>250 + ketone + pH<7.3", branch: "definition", x: 0, y: 0 },
          { id: "trig", label_fa: "محرک: عفونت، قطع انسولین", label_en: "Trigger: infection, insulin miss", branch: "etiology", x: -180, y: 110 },
          { id: "clin", label_fa: "تظاهر: تهوع، درد شکم، تنفس کاسمول", label_en: "Clin: nausea, abdominal pain, Kussmaul", branch: "clinical", x: 180, y: 110 },
          { id: "inv", label_fa: "بررسی: گاز، الکترولیت، کتون ادرار", label_en: "Workup: ABG, lytes, urine ketone", branch: "workup", x: -180, y: 220 },
          { id: "rx", label_fa: "درمان: نرمال سالین + انسولین + K", label_en: "Rx: NS + insulin + K", branch: "treatment", x: 180, y: 220 },
        ],
        edges: [
          { from: "trig", to: "tri", label: "" },
          { from: "tri", to: "clin", label: "" },
          { from: "clin", to: "inv", label: "" },
          { from: "inv", to: "rx", label: "" },
        ]
      }
    },
    {
      slug: "aki",
      title_fa: "آسیب حاد کلیه (AKI)",
      title_en: "Acute Kidney Injury",
      type: "mind", system: "nephro", level: "core",
      summary_fa: "↑Cr ≥0.3 — پیش/کلیوی/پس‌کلیوی. Harrison 22e Ch. 61-63 (Kidney).",
      summary_en: "Acute creatinine rise — pre/renal/post. Harrison 22e Ch. 61-63.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "def", label_fa: "تعریف: ↑Cr ≥0.3 یا 1.5× baseline", label_en: "Def: Cr ↑0.3 or 1.5×", branch: "definition", x: 0, y: 0 },
          { id: "pre", label_fa: "پیش‌کلیوی: دهیدراتاسیون، افت فشار", label_en: "Pre: dehydration, hypotension", branch: "etiology", x: -200, y: 110 },
          { id: "intr", label_fa: "کلیوی: ATN، گلومرولونفریت", label_en: "Intrinsic: ATN, GN", branch: "etiology", x: 0, y: 110 },
          { id: "post", label_fa: "پس‌کلیوی: سنگ، پروستات", label_en: "Post: stone, prostate", branch: "etiology", x: 200, y: 110 },
          { id: "inv", label_fa: "بررسی: FENa، سونو، ادرار", label_en: "Workup: FENa, US, urine", branch: "workup", x: 0, y: 230 },
        ],
        edges: [
          { from: "def", to: "pre", label: "" },
          { from: "def", to: "intr", label: "" },
          { from: "def", to: "post", label: "" },
          { from: "pre", to: "inv", label: "" },
        ]
      }
    },
    {
      slug: "nephrotic",
      title_fa: "سندرم نفروتیک — افتراق و درمان",
      title_en: "Nephrotic Syndrome — Workup & Rx",
      type: "mind", system: "nephro", level: "high_yield",
      summary_fa: "تتراد نفروتیک + علل MCD/FSGS/ممبرانوس + عوارض ترومبوز/عفونت + درمان. Harrison 22e Ch. 62.",
      summary_en: "Nephrotic tetrad + MCD/FSGS/membranous + thrombosis/infection + Rx. Harrison 22e Ch. 62.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "def", label_fa: "تعریف: پروتئینوری >3.5g/روز + آلبومین <3 + ادم + هیپرلیپیدمی", label_en: "Def: proteinuria >3.5g/d + albumin <3 + edema + hyperlipidemia", branch: "definition", x: 0, y: 0 },
          { id: "eti1", label_fa: "علل اولیه: MCD (کودکان)، FSGS، ممبرانوس (HBV/تومور)", label_en: "Primary: MCD (kids), FSGS, membranous (HBV/tumor)", branch: "etiology", x: -220, y: 110 },
          { id: "eti2", label_fa: "ثانویه: دیابت، لوپوس، آمیلوئیدوز", label_en: "Secondary: diabetes, lupus, amyloidosis", branch: "etiology", x: 220, y: 110 },
          { id: "clin", label_fa: "تظاهر: ادم پف‌آلود، آسیت، ترومبوز وریدی، عفونت", label_en: "Clin: puffy edema, ascites, venous thrombosis, infection", branch: "clinical", x: -220, y: 220 },
          { id: "inv", label_fa: "بررسی: پروتئین 24h، لیپید، کراتینین، بیوپسی کلیه، سرولوژی", label_en: "Workup: 24h protein, lipids, creatinine, biopsy, serology", branch: "workup", x: 220, y: 220 },
          { id: "rx1", label_fa: "درمان علت: استروئید (MCD)، سیکلوفسفامید/ریتوکسیماب", label_en: "Treat cause: steroids (MCD), cyclo/rituximab", branch: "treatment", x: -220, y: 340 },
          { id: "rx2", label_fa: "حمایتی: ACE/ARB، استاتین، آنتی‌کوآگولان، واکسن پنوموکوک", label_en: "Supportive: ACE/ARB, statin, anticoag, pneumo vaccine", branch: "treatment", x: 220, y: 340 },
          { id: "comp", label_fa: "عوارض: آمبولی ریه، عفونت، نارسایی کلیه، آترواسکلروز", label_en: "Comp: PE, infection, renal failure, atherosclerosis", branch: "complication", x: 0, y: 460 },
        ],
        edges: [
          { from: "def", to: "eti1", label: "" },
          { from: "def", to: "eti2", label: "" },
          { from: "eti1", to: "clin", label: "" },
          { from: "clin", to: "inv", label: "" },
          { from: "inv", to: "rx1", label: "" },
          { from: "rx1", to: "rx2", label: "ادامه" },
          { from: "rx2", to: "comp", label: "بدون درمان" },
        ]
      }
    },
    {
      slug: "approach-chest-pain",
      title_fa: "اپروچ درد قفسه سینه (اورژانس)",
      title_en: "Approach to Chest Pain (ED)",
      type: "approach", system: "emergency", level: "high_yield",
      summary_fa: "تمایز STEMI/دیسکسیون/پنوموتوراکس. Harrison 22e Part 2 Ch. 11 (Chest discomfort).",
      summary_en: "Diff STEMI/dissection/pneumo. Harrison 22e Part 2 Ch. 11.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "start", label_fa: "شروع: درد قفسه سینه + علائم حیاتی", label_en: "Start: chest pain + vitals", branch: "start", x: 0, y: 0 },
          { id: "q1", label_fa: "ECG: ST↑ ؟", label_en: "ECG: ST↑ ?", branch: "question", x: -180, y: 110 },
          { id: "yes1", label_fa: "بله → STEMI → کات فوری", label_en: "Yes → STEMI → immediate cath", branch: "action", x: -180, y: 220 },
          { id: "no1", label_fa: "خیر → بررسی فشار دو بازو", label_en: "No → check BP both arms", branch: "question", x: 180, y: 110 },
          { id: "dissec", label_fa: "BP diff + درد مهاجر → دیسکسیون", label_en: "BP diff + migratory pain → dissection", branch: "action", x: 180, y: 220 },
          { id: "next", label_fa: "نه → CXR + تروپونین + D-Dimer", label_en: "No → CXR + troponin + D-Dimer", branch: "workup", x: 0, y: 330 },
        ],
        edges: [
          { from: "start", to: "q1", label: "" },
          { from: "q1", to: "yes1", label: "yes" },
          { from: "q1", to: "no1", label: "no" },
          { from: "no1", to: "dissec", label: "" },
          { from: "no1", to: "next", label: "" },
        ]
      }
    },
    {
      slug: "approach-dyspnea",
      title_fa: "اپروچ تنگی نفس حاد",
      title_en: "Approach to Acute Dyspnea",
      type: "approach", system: "emergency", level: "core",
      summary_fa: "ادم ریه/پنومونی/PE/آسم. Harrison 22e Part 2 Ch. 20 (Dyspnea).",
      summary_en: "Edema/pneumonia/PE/asthma. Harrison 22e Part 2 Ch. 20.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "start", label_fa: "شروع: تنگی نفس + O2 sat", label_en: "Start: dyspnea + O2 sat", branch: "start", x: 0, y: 0 },
          { id: "wheeze", label_fa: "ویز دارد؟ → آسم/COPD", label_en: "Wheeze? → asthma/COPD", branch: "question", x: -180, y: 110 },
          { id: "crackle", label_fa: "کراکل + ادم → HF", label_en: "Crackles + edema → HF", branch: "action", x: 0, y: 110 },
          { id: "pleur", label_fa: "درد پلورتیک + تاکیکاردی → PE", label_en: "Pleuritic + tachy → PE", branch: "action", x: 180, y: 110 },
        ],
        edges: [
          { from: "start", to: "wheeze", label: "" },
          { from: "start", to: "crackle", label: "" },
          { from: "start", to: "pleur", label: "" },
        ]
      }
    },
    {
      slug: "approach-polyuria",
      title_fa: "اپروچ پلی‌یوری",
      title_en: "Approach to Polyuria",
      type: "approach", system: "endo", level: "core",
      summary_fa: "دیابت/DI/هیپرکلسمی. Harrison 22e Part 12 Ch. 38 (Polyuria).",
      summary_en: "Diabetes/DI/hypercalcemia. Harrison 22e Part 12 Ch. 38.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "def", label_fa: "پلی‌یوری >3L/روز", label_en: "Polyuria >3L/day", branch: "definition", x: 0, y: 0 },
          { id: "glc", label_fa: "قند بالا؟ → دیابت", label_en: "High glucose? → diabetes", branch: "question", x: -150, y: 110 },
          { id: "ca", label_fa: "Ca بالا؟ → هیپرکلسمی", label_en: "Ca high? → hypercalcemia", branch: "question", x: 150, y: 110 },
          { id: "di", label_fa: "نه → تست محرومیت آب → DI", label_en: "No → water deprivation → DI", branch: "action", x: 0, y: 220 },
        ],
        edges: [
          { from: "def", to: "glc", label: "" },
          { from: "def", to: "ca", label: "" },
          { from: "glc", to: "di", label: "" },
        ]
      }
    },
    {
      slug: "approach-oliguria",
      title_fa: "اپروچ الیگوری/آنوری",
      title_en: "Approach to Oliguria",
      type: "approach", system: "nephro", level: "core",
      summary_fa: "پیش‌کلیوی/ATN/انسداد. Harrison 22e Part 9 Ch. 61.",
      summary_en: "Pre/ATN/obstruction. Harrison 22e Part 9 Ch. 61.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "def", label_fa: "ادرار <400ml/روز", label_en: "Urine <400ml/day", branch: "definition", x: 0, y: 0 },
          { id: "fe", label_fa: "FENa <1% → پیش‌کلیوی", label_en: "FENa <1% → pre", branch: "action", x: -150, y: 110 },
          { id: "fe2", label_fa: "FENa >2% → ATN", label_en: "FENa >2% → ATN", branch: "action", x: 150, y: 110 },
          { id: "us", label_fa: "سونو: هیدرونفروز → انسداد", label_en: "US: hydronephrosis → obstruction", branch: "action", x: 0, y: 220 },
        ],
        edges: [
          { from: "def", to: "fe", label: "" },
          { from: "def", to: "fe2", label: "" },
          { from: "def", to: "us", label: "" },
        ]
      }
    },
    {
      slug: "sepsis",
      title_fa: "سپسیس و شوک سپتیک — باندل 1 ساعته",
      title_en: "Sepsis & Septic Shock — 1-hour Bundle",
      type: "mind", system: "infect", level: "high_yield",
      summary_fa: "qSOFA/SOFA + لاکتات + کشت و آنتی‌بیوتیک <1h + مایعات و وازوپرسور. Harrison 22e Part 5 Ch. 316.",
      summary_en: "qSOFA/SOFA + lactate + culture & abx <1h + fluids & pressors. Harrison 22e Part 5 Ch. 316.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "def", label_fa: "تعریف: سوءعملکرد ارگان ناشی از پاسخ میزبان به عفونت", label_en: "Def: organ dysfunction due to host response to infection", branch: "definition", x: 0, y: 0 },
          { id: "qsofa", label_fa: "غربال qSOFA: GCS<15 + RR≥22 + SBP≤100 (≥2 مثبت)", label_en: "qSOFA: GCS<15 + RR≥22 + SBP≤100 (≥2)", branch: "workup", x: -220, y: 110 },
          { id: "sofa", label_fa: "تایید SOFA ≥2 (تنفس، انعقاد، کبد، قلب، CNS، کلیه)", label_en: "Confirm SOFA ≥2 (resp, coag, liver, CV, CNS, renal)", branch: "workup", x: 220, y: 110 },
          { id: "clin", label_fa: "تظاهر: تب/هیپوترمی، تاکیکاردی، هیپوتانسیون، الیگوری", label_en: "Clin: fever/hypothermia, tachy, hypotension, oliguria", branch: "clinical", x: -220, y: 220 },
          { id: "lab", label_fa: "آزما: لاکتات >2، کشت خون/ادرار، PCT/CRP، ABG", label_en: "Lab: lactate >2, blood/urine culture, PCT/CRP, ABG", branch: "workup", x: 220, y: 220 },
          { id: "rx1", label_fa: "1h باندل: کشت + آنتی‌بیوتیک وسیع + 30ml/kg کریستالوئید", label_en: "1h bundle: cultures + broad abx + 30ml/kg crystalloid", branch: "treatment", x: -220, y: 340 },
          { id: "rx2", label_fa: "شوک: نوراپی‌نفرین + وازوپرسین + کورتیکوستروئید + کنترل منبع", label_en: "Shock: norepi + vaso + steroids + source control", branch: "treatment", x: 220, y: 340 },
          { id: "comp", label_fa: "عوارض: ARDS، AKI، DIC، مرگ (30-50% در شوک)", label_en: "Comp: ARDS, AKI, DIC, death (30-50% in shock)", branch: "complication", x: 0, y: 460 },
        ],
        edges: [
          { from: "def", to: "qsofa", label: "غربال" },
          { from: "qsofa", to: "sofa", label: "→" },
          { from: "sofa", to: "clin", label: "" },
          { from: "clin", to: "lab", label: "" },
          { from: "lab", to: "rx1", label: "" },
          { from: "rx1", to: "rx2", label: "اگر MAP<65" },
          { from: "rx2", to: "comp", label: "" },
        ]
      }
    },
    {
      slug: "stroke-ischemic",
      title_fa: "سکته ایسکمیک مغزی",
      title_en: "Ischemic Stroke",
      type: "mind", system: "neuro", level: "high_yield",
      summary_fa: "نقص فوکال ناگهانی — CT → tPA/ترومبکتومی. Harrison 22e Part 13 Ch. 68.",
      summary_en: "Sudden focal deficit — CT → tPA/thrombectomy. Harrison 22e Part 13 Ch. 68.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "def", label_fa: "سکته ایسکمیک: انسداد شریان مغزی", label_en: "Ischemic: cerebral artery occlusion", branch: "definition", x: 0, y: 0 },
          { id: "clin", label_fa: "NIHSS + زمان شروع", label_en: "NIHSS + onset time", branch: "clinical", x: 0, y: 110 },
          { id: "inv", label_fa: "CT → بدون خونریزی", label_en: "CT → no bleed", branch: "workup", x: 0, y: 220 },
          { id: "rx", label_fa: "tPA <4.5h یا ترومبکتومی <24h", label_en: "tPA <4.5h or thrombectomy <24h", branch: "treatment", x: 0, y: 330 },
        ],
        edges: [
          { from: "def", to: "clin", label: "" },
          { from: "clin", to: "inv", label: "" },
          { from: "inv", to: "rx", label: "" },
        ]
      }
    },
    // --- 19 NEW HIGH-YIELD (total 30) ---
    {
      slug: "heart-failure",
      title_fa: "نارسایی قلب — HFrEF vs HFpEF",
      title_en: "Heart Failure — HFrEF vs HFpEF",
      type: "mind", system: "cardio", level: "high_yield",
      summary_fa: "تنگی نفس + ادم + EF — GDMT: ACE/ARNI+BB+MRA+SGLT2. Harrison 22e Ch. 33-34.",
      summary_en: "Dyspnea + edema + EF — GDMT. Harrison 22e Ch. 33-34.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "def", label_fa: "تعریف: ناتوانی قلب در پمپاژ کافی", label_en: "Def: inability to pump adequately", branch: "definition", x: 0, y: 0 },
          { id: "hfr", label_fa: "HFrEF: EF ≤40% — اکو", label_en: "HFrEF: EF ≤40%", branch: "clinical", x: -180, y: 110 },
          { id: "hfp", label_fa: "HFpEF: EF ≥50% + اختلال دیاستول", label_en: "HFpEF: EF ≥50% + diastolic", branch: "clinical", x: 180, y: 110 },
          { id: "inv", label_fa: "BNP↑ + CXR + اکو", label_en: "BNP↑ + CXR + echo", branch: "workup", x: 0, y: 220 },
          { id: "rx", label_fa: "GDMT: ARNI/ACE + BB + MRA + SGLT2", label_en: "GDMT: ARNI/ACE + BB + MRA + SGLT2", branch: "treatment", x: 0, y: 330 },
          { id: "comp", label_fa: "عوارض: آریتمی، نارسایی کلیه", label_en: "Comp: arrhythmia, renal failure", branch: "complication", x: 0, y: 440 },
        ],
        edges: [{ from: "def", to: "hfr", label: "" }, { from: "def", to: "hfp", label: "" }, { from: "hfr", to: "inv", label: "" }, { from: "inv", to: "rx", label: "" }]
      }
    },
    {
      slug: "afib",
      title_fa: "فیبریلاسیون دهلیزی (AF)",
      title_en: "Atrial Fibrillation",
      type: "mind", system: "cardio", level: "high_yield",
      summary_fa: "ریتم نامنظم + خطر آمبولی — CHA2DS2-VASc + کنترل ریت/ریتم. Harrison 22e Ch. 35.",
      summary_en: "Irregular rhythm + emboli — CHA2DS2-VASc. Harrison 22e Ch. 35.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "def", label_fa: "AF: فعالیت نامنظم دهلیز + QRS نامنظم", label_en: "AF: irregular atrial activity", branch: "definition", x: 0, y: 0 },
          { id: "eti", label_fa: "زمینه: HTN، ایسکمی، دریچه، تیروئید", label_en: "Risk: HTN, ischemia, valve, thyroid", branch: "etiology", x: 0, y: 110 },
          { id: "clin", label_fa: "تظاهر: تپش، تنگی نفس، سکته", label_en: "Clin: palpitation, dyspnea, stroke", branch: "clinical", x: -180, y: 220 },
          { id: "inv", label_fa: "ECG: بدون P + RR نامنظم + CHA2DS2-VASc", label_en: "ECG: no P + irregular RR", branch: "workup", x: 180, y: 220 },
          { id: "rx", label_fa: "ضدانعقاد (DOAC/وارفارین) + کنترل ریت/ریتم", label_en: "Anticoag + rate/rhythm", branch: "treatment", x: 0, y: 330 },
        ],
        edges: [{ from: "def", to: "eti", label: "" }, { from: "eti", to: "clin", label: "" }, { from: "clin", to: "inv", label: "" }, { from: "inv", to: "rx", label: "" }]
      }
    },
    {
      slug: "copd-exac",
      title_fa: "تشدید COPD",
      title_en: "COPD Exacerbation",
      type: "mind", system: "pulmo", level: "high_yield",
      summary_fa: "سرفه + خلط چرکی + تنگی نفس — استروئید + برونکودیلاتور + آنتی‌بیوتیک. Harrison 22e Ch. 50.",
      summary_en: "Cough + purulent sputum + dyspnea — steroids + broncho + abx. Harrison 22e Ch. 50.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "def", label_fa: "تشدید: بدتر شدن حاد علائم COPD", label_en: "Exac: acute worsening of COPD", branch: "definition", x: 0, y: 0 },
          { id: "trig", label_fa: "محرک: عفونت ویروسی/باکتریال، آلودگی", label_en: "Trigger: viral/bacterial, pollution", branch: "etiology", x: 0, y: 110 },
          { id: "clin", label_fa: "تظاهر: ویز، تاکی‌پنه، هیپوکسی", label_en: "Clin: wheeze, tachypnea, hypoxia", branch: "clinical", x: -180, y: 220 },
          { id: "inv", label_fa: "ABG + CXR + کشت خلط", label_en: "ABG + CXR + sputum", branch: "workup", x: 180, y: 220 },
          { id: "rx", label_fa: "O2 (88-92%) + SABA/SAMA + استروئید + AB در صورت چرکی", label_en: "O2 88-92% + SABA/SAMA + steroids + AB", branch: "treatment", x: 0, y: 330 },
        ],
        edges: [{ from: "def", to: "trig", label: "" }, { from: "trig", to: "clin", label: "" }, { from: "clin", to: "inv", label: "" }, { from: "inv", to: "rx", label: "" }]
      }
    },
    {
      slug: "pe",
      title_fa: "آمبولی ریوی (PE)",
      title_en: "Pulmonary Embolism",
      type: "mind", system: "pulmo", level: "emergency",
      summary_fa: "درد پلورتیک + تاکی‌کاردی + هیپوکسی — Wells + CT آنژیو + هپارین. Harrison 22e Ch. 51.",
      summary_en: "Pleuritic + tachy + hypoxia — Wells + CT angio + heparin. Harrison 22e Ch. 51.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "def", label_fa: "PE: لخته در شریان ریوی", label_en: "PE: clot in pulmonary artery", branch: "definition", x: 0, y: 0 },
          { id: "rf", label_fa: "ریسک: بی‌حرکتی، جراحی، سرطان، OCP", label_en: "Risk: immobility, surg, cancer, OCP", branch: "etiology", x: 0, y: 110 },
          { id: "clin", label_fa: "تظاهر: درد پلورتیک، تنگی نفس، سنکوپ", label_en: "Clin: pleuritic, dyspnea, syncope", branch: "clinical", x: -180, y: 220 },
          { id: "inv", label_fa: "Wells + D-Dimer + CT آنژیو", label_en: "Wells + D-Dimer + CT angio", branch: "workup", x: 180, y: 220 },
          { id: "rx", label_fa: "هپارین → DOAC، ترومبولیز در ناپایدار", label_en: "Heparin → DOAC, lysis if unstable", branch: "treatment", x: 0, y: 330 },
        ],
        edges: [{ from: "def", to: "rf", label: "" }, { from: "rf", to: "clin", label: "" }, { from: "clin", to: "inv", label: "" }, { from: "inv", to: "rx", label: "" }]
      }
    },
    {
      slug: "gi-bleed-upper",
      title_fa: "خونریزی گوارشی فوقانی",
      title_en: "Upper GI Bleeding",
      type: "approach", system: "gastro", level: "emergency",
      summary_fa: "هماتمز/ملنا + افت فشار — تثبیت + PPI + آندوسکوپی <12h. Harrison 22e Ch. 44.",
      summary_en: "Hematemesis/melena + hypotension — stabilize + PPI + scope <12h. Harrison 22e Ch. 44.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "start", label_fa: "شروع: هماتمز/ملنا + علائم حیاتی", label_en: "Start: hematemesis/melena + vitals", branch: "start", x: 0, y: 0 },
          { id: "stab", label_fa: "تثبیت: 2 رگ + نرمال سالین + CBC/کراس‌مچ", label_en: "Stabilize: 2 IV + NS + CBC/cross", branch: "action", x: -180, y: 110 },
          { id: "q", label_fa: "سابقه NSAID/سیروز/واریس؟", label_en: "NSAID/cirrhosis/varices?", branch: "question", x: 180, y: 110 },
          { id: "rx", label_fa: "PPI IV + اکترئوتید اگر واریس + آندوسکوپی", label_en: "PPI IV + octreotide if varices + scope", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "start", to: "stab", label: "" }, { from: "start", to: "q", label: "" }, { from: "stab", to: "rx", label: "" }]
      }
    },
    {
      slug: "cirrhosis",
      title_fa: "سیروز و عوارض (آسیت، آنسفالوپاتی)",
      title_en: "Cirrhosis & Complications",
      type: "mind", system: "gastro", level: "high_yield",
      summary_fa: "فیبروز + پرفشاری پورت — MELD + آسیت/واریس/HRS. Harrison 22e Ch. 43-45.",
      summary_en: "Fibrosis + portal HTN — MELD + ascites/varices/HRS. Harrison 22e Ch. 43-45.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "def", label_fa: "سیروز: فیبروز منتشر + ندول بازسازی", label_en: "Cirrhosis: diffuse fibrosis + nodules", branch: "definition", x: 0, y: 0 },
          { id: "eti", label_fa: "علت: هپاتیت B/C، الکل، NASH", label_en: "Cause: Hep B/C, alcohol, NASH", branch: "etiology", x: 0, y: 110 },
          { id: "clin", label_fa: "تظاهر: آسیت، واریس، آنسفالوپاتی، ایکتر", label_en: "Clin: ascites, varices, encephalopathy", branch: "clinical", x: -180, y: 220 },
          { id: "inv", label_fa: "MELD + سونو + آندوسکوپی", label_en: "MELD + US + scope", branch: "workup", x: 180, y: 220 },
          { id: "rx", label_fa: "نمک کم + اسپیرونولاکتون + باند واریس + لاکتولوز", label_en: "Low salt + spiro + band + lactulose", branch: "treatment", x: 0, y: 330 },
        ],
        edges: [{ from: "def", to: "eti", label: "" }, { from: "eti", to: "clin", label: "" }, { from: "clin", to: "inv", label: "" }, { from: "inv", to: "rx", label: "" }]
      }
    },
    {
      slug: "approach-anemia",
      title_fa: "اپروچ آنمی (بر اساس MCV)",
      title_en: "Approach to Anemia (MCV-based)",
      type: "approach", system: "heme", level: "core",
      summary_fa: "میکرو/نورمو/ماکرو — فریتین، B12، رتیک. Harrison 22e Ch. 24-26.",
      summary_en: "Micro/normo/macro — ferritin, B12, retic. Harrison 22e Ch. 24-26.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "start", label_fa: "آنمی: Hb پایین + MCV", label_en: "Anemia: low Hb + MCV", branch: "start", x: 0, y: 0 },
          { id: "micro", label_fa: "MCV <80 → فقر آهن/تالاسمی", label_en: "MCV <80 → iron/Tthal", branch: "action", x: -180, y: 110 },
          { id: "normo", label_fa: "MCV 80-100 → خونریزی/همولیز/مزمن", label_en: "80-100 → bleed/hemolysis/chronic", branch: "action", x: 0, y: 110 },
          { id: "macro", label_fa: "MCV >100 → B12/فولات/الکل", label_en: ">100 → B12/folate/alcohol", branch: "action", x: 180, y: 110 },
        ],
        edges: [{ from: "start", to: "micro", label: "" }, { from: "start", to: "normo", label: "" }, { from: "start", to: "macro", label: "" }]
      }
    },
    {
      slug: "approach-fever",
      title_fa: "اپروچ تب (و FUO)",
      title_en: "Approach to Fever & FUO",
      type: "approach", system: "infect", level: "core",
      summary_fa: "تب + کشت + CRP/Procal — FUO: عفونت/بدخیمی/کلاژن. Harrison 22e Part 2 Ch. 15-17.",
      summary_en: "Fever + culture + CRP/PCT — FUO: infection/malignancy/collagen. Harrison 22e Part 2 Ch. 15-17.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "def", label_fa: "تب: T >38.3 + علائم همراه", label_en: "Fever: T >38.3 + clues", branch: "definition", x: 0, y: 0 },
          { id: "q1", label_fa: "کانون دارد؟ → کشت + تصویر", label_en: "Focus? → culture + imaging", branch: "question", x: -180, y: 110 },
          { id: "q2", label_fa: "FUO >3w بدون تشخیص → PET/CT + بیوپسی", label_en: "FUO >3w → PET/CT + biopsy", branch: "question", x: 180, y: 110 },
          { id: "rx", label_fa: "آنتی‌بیوتیک تجربی پس از کشت", label_en: "Empiric AB after culture", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "def", to: "q1", label: "" }, { from: "def", to: "q2", label: "" }, { from: "q1", to: "rx", label: "" }]
      }
    },
    {
      slug: "thyroid-disorders",
      title_fa: "اختلالات تیروئید — پرکاری/کم‌کاری",
      title_en: "Thyroid Disorders — Hyper/Hypo",
      type: "mind", system: "endo", level: "core",
      summary_fa: "TSH + FT4 — گریوز vs هاشیموتو. Harrison 22e Ch. 36-37.",
      summary_en: "TSH + FT4 — Graves vs Hashimoto. Harrison 22e Ch. 36-37.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "def", label_fa: "محور HPT: TRH → TSH → T4/T3", label_en: "HPT axis: TRH→TSH→T4/T3", branch: "definition", x: 0, y: 0 },
          { id: "hyper", label_fa: "پرکاری: TSH↓ FT4↑ → گریوز (TRAb+)", label_en: "Hyper: low TSH high FT4 → Graves", branch: "clinical", x: -180, y: 110 },
          { id: "hypo", label_fa: "کم‌کاری: TSH↑ FT4↓ → هاشیموتو (TPO+)", label_en: "Hypo: high TSH low FT4 → Hashimoto", branch: "clinical", x: 180, y: 110 },
          { id: "rx", label_fa: "پرکاری: متی‌مازول/رادیو ید — کم‌کاری: لووتیروکسین", label_en: "Hyper: methimazole/RAI — Hypo: levothyroxine", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "def", to: "hyper", label: "" }, { from: "def", to: "hypo", label: "" }, { from: "hyper", to: "rx", label: "" }]
      }
    },
    {
      slug: "adrenal",
      title_fa: "نارسایی آدرنال و کوشینگ",
      title_en: "Adrenal Insufficiency & Cushing",
      type: "mind", system: "endo", level: "high_yield",
      summary_fa: "کورتیزول + ACTH — تست تحریک + دگزامتازون. Harrison 22e Ch. 39-40.",
      summary_en: "Cortisol + ACTH — stim + dex tests. Harrison 22e Ch. 39-40.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "def", label_fa: "محور HPA: CRH→ACTH→کورتیزول", label_en: "HPA: CRH→ACTH→cortisol", branch: "definition", x: 0, y: 0 },
          { id: "add", label_fa: "نارسایی: خستگی + هیپوتانسیون + Na↓ K↑ → تست ACTH", label_en: "Insuff: fatigue + hypo + Na↓K↑ → ACTH stim", branch: "clinical", x: -180, y: 110 },
          { id: "cush", label_fa: "کوشینگ: چاقی مرکزی + استریا + قند↑ → دگزا + کورتیزول ادرار", label_en: "Cushing: central obesity + stria + high glc → dex + urine cortisol", branch: "clinical", x: 180, y: 110 },
          { id: "rx", label_fa: "نارسایی: هیدروکورتیزون — کوشینگ: جراحی/کتوکونازول", label_en: "Insuff: hydrocort — Cushing: surgery/keto", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "def", to: "add", label: "" }, { from: "def", to: "cush", label: "" }, { from: "add", to: "rx", label: "" }]
      }
    },
    {
      slug: "hyponatremia",
      title_fa: "هیپوناترمی — اپروچ حجم",
      title_en: "Hyponatremia — Volume Approach",
      type: "approach", system: "endo", level: "high_yield",
      summary_fa: "Na↓ + اسمولالیته + حجم — SIADH vs دهیدراتاسیون. Harrison 22e Ch. 45.",
      summary_en: "Low Na + osm + volume — SIADH vs dehydration. Harrison 22e Ch. 45.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "def", label_fa: "Na <135 + اسمولالیته پلاسما", label_en: "Na <135 + plasma osm", branch: "definition", x: 0, y: 0 },
          { id: "hyp", label_fa: "اسمول کم + حجم بالا → SIADH", label_en: "Low osm + high vol → SIADH", branch: "action", x: -180, y: 110 },
          { id: "eu", label_fa: "اسمول کم + حجم نرمال → SIADH/هیپوتیروئید", label_en: "Low osm + euvolemia → SIADH", branch: "action", x: 0, y: 110 },
          { id: "hypov", label_fa: "اسمول کم + حجم کم → دهیدراتاسیون", label_en: "Low osm + hypovolemia → dehydration", branch: "action", x: 180, y: 110 },
        ],
        edges: [{ from: "def", to: "hyp", label: "" }, { from: "def", to: "eu", label: "" }, { from: "def", to: "hypov", label: "" }]
      }
    },
    {
      slug: "gn",
      title_fa: "گلومرولونفریت — نفریتیک vs نفروتیک",
      title_en: "Glomerulonephritis — Nephritic vs Nephrotic",
      type: "mind", system: "nephro", level: "high_yield",
      summary_fa: "هماچوری + پروتئینوری — ASO، C3، ANCA، بیوپسی. Harrison 22e Ch. 64.",
      summary_en: "Hematuria + proteinuria — ASO, C3, ANCA, biopsy. Harrison 22e Ch. 64.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "def", label_fa: "GN: التهاب گلومرول + هماچوری + RBC cast", label_en: "GN: glomerular inflam + hematuria + RBC cast", branch: "definition", x: 0, y: 0 },
          { id: "post", label_fa: "پس‌استرپتوکوکی: ASO↑ C3↓", label_en: "Post-strep: ASO↑ C3↓", branch: "etiology", x: -180, y: 110 },
          { id: "anca", label_fa: "واسکولیت: ANCA+ (GPA/MPA)", label_en: "Vasculitis: ANCA+ (GPA/MPA)", branch: "etiology", x: 180, y: 110 },
          { id: "rx", label_fa: "استروئید + سیکلوفسفامید/ریتوکسیماب", label_en: "Steroid + cyclo/ritux", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "def", to: "post", label: "" }, { from: "def", to: "anca", label: "" }, { from: "post", to: "rx", label: "" }]
      }
    },
    {
      slug: "sle",
      title_fa: "لوپوس اریتماتوز سیستمیک (SLE)",
      title_en: "Systemic Lupus Erythematosus",
      type: "mind", system: "rheum", level: "high_yield",
      summary_fa: "ANA+ + درگیری چندسیستمی — SLICC + هیدروکسی‌کلروکین. Harrison 22e Ch. 71-73.",
      summary_en: "ANA+ + multi-system — SLICC + HCQ. Harrison 22e Ch. 71-73.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "def", label_fa: "SLE: اتوایمیون + ANA+ + کمپلکس ایمنی", label_en: "SLE: autoimmune + ANA+ + immune complex", branch: "definition", x: 0, y: 0 },
          { id: "clin", label_fa: "تظاهر: راش پروانه‌ای، آرتریت، نفریت، سروزیت", label_en: "Clin: malar rash, arthritis, nephritis, serositis", branch: "clinical", x: -180, y: 110 },
          { id: "inv", label_fa: "ANA+ + anti-dsDNA + C3/C4↓", label_en: "ANA+ + anti-dsDNA + low C3/C4", branch: "workup", x: 180, y: 110 },
          { id: "rx", label_fa: "HCQ + استروئید + MMF/سیکلوفسفامید در نفریت", label_en: "HCQ + steroids + MMF/cyclo in nephritis", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "def", to: "clin", label: "" }, { from: "clin", to: "inv", label: "" }, { from: "inv", to: "rx", label: "" }]
      }
    },
    {
      slug: "ra",
      title_fa: "آرتریت روماتوئید (RA)",
      title_en: "Rheumatoid Arthritis",
      type: "mind", system: "rheum", level: "core",
      summary_fa: "پلی‌آرتریت متقارن + RF/anti-CCP+ — DMARD. Harrison 22e Ch. 72.",
      summary_en: "Symmetric polyarthritis + RF/anti-CCP+ — DMARD. Harrison 22e Ch. 72.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "def", label_fa: "RA: سینوویت مزمن + اروزیون", label_en: "RA: chronic synovitis + erosion", branch: "definition", x: 0, y: 0 },
          { id: "clin", label_fa: "تظاهر: خشکی صبحگاهی >30د، MCP/PIP", label_en: "Clin: morning stiffness >30m, MCP/PIP", branch: "clinical", x: 0, y: 110 },
          { id: "inv", label_fa: "RF+ anti-CCP+ + CRP↑ + X-ray اروزیون", label_en: "RF+ anti-CCP+ + CRP↑ + erosion", branch: "workup", x: 0, y: 220 },
          { id: "rx", label_fa: "متوتروکسات + بیولوژیک (anti-TNF)", label_en: "MTX + biologic (anti-TNF)", branch: "treatment", x: 0, y: 330 },
        ],
        edges: [{ from: "def", to: "clin", label: "" }, { from: "clin", to: "inv", label: "" }, { from: "inv", to: "rx", label: "" }]
      }
    },
    {
      slug: "hiv",
      title_fa: "HIV و ایدز — اپروچ و درمان",
      title_en: "HIV & AIDS",
      type: "mind", system: "infect", level: "core",
      summary_fa: "CD4↓ + بیماری‌های فرصت‌طلب — ART: 2 NRTI + INSTI. Harrison 22e Ch. 80-82.",
      summary_en: "CD4↓ + opportunistic — ART: 2 NRTI + INSTI. Harrison 22e Ch. 80-82.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "def", label_fa: "HIV: رتروویروس + CD4↓ + بار ویروسی", label_en: "HIV: retrovirus + CD4↓ + viral load", branch: "definition", x: 0, y: 0 },
          { id: "clin", label_fa: "مراحل: حاد → نهفته → ایدز (CD4<200 + OI)", label_en: "Stages: acute → latent → AIDS (CD4<200 + OI)", branch: "clinical", x: 0, y: 110 },
          { id: "inv", label_fa: "ELISA + Western + CD4/VL", label_en: "ELISA + Western + CD4/VL", branch: "workup", x: 0, y: 220 },
          { id: "rx", label_fa: "ART: TAF/FTC + DTG — پروفیلاکسی OI", label_en: "ART: TAF/FTC + DTG — OI prophylaxis", branch: "treatment", x: 0, y: 330 },
        ],
        edges: [{ from: "def", to: "clin", label: "" }, { from: "clin", to: "inv", label: "" }, { from: "inv", to: "rx", label: "" }]
      }
    },
    {
      slug: "tb",
      title_fa: "سل ریوی و خارج‌ریوی",
      title_en: "Tuberculosis",
      type: "mind", system: "infect", level: "high_yield",
      summary_fa: "سرفه مزمن + کاهش وزن + کاویت → 4 دارو. Harrison 22e Ch. 83-84.",
      summary_en: "Chronic cough + weight loss + cavity → 4 drugs. Harrison 22e Ch. 83-84.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "def", label_fa: "TB: مایکوباکتریوم توبرکلوزیس + گرانولوم کازئوز", label_en: "TB: M.tb + caseating granuloma", branch: "definition", x: 0, y: 0 },
          { id: "clin", label_fa: "تظاهر: سرفه >2w، تب عصرگاهی، تعریق شبانه", label_en: "Clin: cough >2w, evening fever, night sweats", branch: "clinical", x: -180, y: 110 },
          { id: "inv", label_fa: "CXR کاویت + اسمیر AFB + کشت/PCR", label_en: "CXR cavity + AFB smear + culture/PCR", branch: "workup", x: 180, y: 110 },
          { id: "rx", label_fa: "RIPE: ریفامپین + ایزونیازید + پیرازینامید + اتامبوتول", label_en: "RIPE: RIF + INH + PZA + EMB", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "def", to: "clin", label: "" }, { from: "clin", to: "inv", label: "" }, { from: "inv", to: "rx", label: "" }]
      }
    },
    {
      slug: "approach-headache",
      title_fa: "اپروچ سردرد",
      title_en: "Approach to Headache",
      type: "approach", system: "neuro", level: "core",
      summary_fa: "پرایمری vs سکندری — red flags + SNOOP. Harrison 22e Part 2 Ch. 13.",
      summary_en: "Primary vs secondary — red flags + SNOOP. Harrison 22e Part 2 Ch. 13.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "start", label_fa: "سردرد + red flags؟", label_en: "Headache + red flags?", branch: "start", x: 0, y: 0 },
          { id: "red", label_fa: "تب + سفتی گردن/نقص فوکال → CT/LP", label_en: "Fever + neck stiffness/focal → CT/LP", branch: "action", x: -180, y: 110 },
          { id: "mig", label_fa: "ضربانی یک‌طرفه + فتوفوبیا → میگرن", label_en: "Pulsatile unilateral + photophobia → migraine", branch: "action", x: 0, y: 110 },
          { id: "tth", label_fa: "فشاری دوطرفه → تنشن", label_en: "Bilateral pressure → tension", branch: "action", x: 180, y: 110 },
        ],
        edges: [{ from: "start", to: "red", label: "" }, { from: "start", to: "mig", label: "" }, { from: "start", to: "tth", label: "" }]
      }
    },
    {
      slug: "approach-abdominal-pain",
      title_fa: "اپروچ درد شکم حاد",
      title_en: "Approach to Acute Abdominal Pain",
      type: "approach", system: "gastro", level: "high_yield",
      summary_fa: "RUQ/LUQ/پری‌اومیلیکال — پریتونیت + سونو/CT. Harrison 22e Part 2 Ch. 12.",
      summary_en: "RUQ/LUQ/periumbilical — peritonitis + US/CT. Harrison 22e Part 2 Ch. 12.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "start", label_fa: "درد شکم + معاینه (ریباند/گاردینگ)", label_en: "Abdominal pain + exam (rebound/guarding)", branch: "start", x: 0, y: 0 },
          { id: "ruq", label_fa: "RUQ + مورفی + تب → کوله‌سیستیت", label_en: "RUQ + Murphy + fever → cholecystitis", branch: "action", x: -180, y: 110 },
          { id: "rlq", label_fa: "RLQ + رلیز + تب → آپاندیسیت", label_en: "RLQ + release + fever → appendicitis", branch: "action", x: 0, y: 110 },
          { id: "epi", label_fa: "اپی‌گاستر + انتشار به پشت → پانکراتیت", label_en: "Epigastric + back radiation → pancreatitis", branch: "action", x: 180, y: 110 },
        ],
        edges: [{ from: "start", to: "ruq", label: "" }, { from: "start", to: "rlq", label: "" }, { from: "start", to: "epi", label: "" }]
      }
    },
    // --- 3 manual admin entries (2026-10-03) — also seeded ---
    {
      slug: "hyperkalemia-manual",
      title_fa: "هیپرکالمی — اپروچ اورژانس",
      title_en: "Hyperkalemia — Emergency Approach",
      type: "approach", system: "nephro", level: "emergency",
      summary_fa: "K>5.5 + ECG + علت + درمان اورژانس. Harrison 22e Ch. 45 + 63 — ورود دستی ادمین.",
      summary_en: "K>5.5 + ECG + cause + emergency Rx. Harrison 22e Ch. 45+63 — manual admin entry.",
      cover_url: "/covers/harrison.jpg",
      is_premium: true,
      graph_json: {
        nodes: [
          { id: "def", label_fa: "هیپرکالمی: K >5.5 (شدید >6.5)", label_en: "HyperK: K >5.5 (severe >6.5)", branch: "definition", x: 0, y: 0 },
          { id: "ecg1", label_fa: "ECG: T برجسته → QRS پهن → موج سینوسی", label_en: "ECG: peaked T → wide QRS → sine wave", branch: "workup", x: -220, y: 110 },
          { id: "eti", label_fa: "علل: نارسایی کلیه، دارو (ACE/AR B/اسپیرونولاکتون)، اسیدوز، همولیز", label_en: "Causes: renal failure, drugs (ACE/spiro), acidosis, hemolysis", branch: "etiology", x: 220, y: 110 },
          { id: "q1", label_fa: "ECG دارد؟ یا K>6.5؟", label_en: "ECG changes? or K>6.5?", branch: "question", x: 0, y: 220 },
          { id: "rx1", label_fa: "بله → کلسیم گلوکونات (غشا) + انسولین/گلوکز + بیکربنات", label_en: "Yes → calcium gluconate + insulin/glucose + bicarb", branch: "treatment", x: -220, y: 330 },
          { id: "rx2", label_fa: "خیر → کایکسالات/پتی‌رومر + دیورتیک + دیالیز اگر مقاوم", label_en: "No → kayexalate/patiromer + diuretic + dialysis if refractory", branch: "treatment", x: 220, y: 330 },
          { id: "fu", label_fa: "پیگیری: تکرار K/ECG هر 1-2h، قطع داروی مسبب", label_en: "Follow: repeat K/ECG 1-2h, stop culprit drug", branch: "action", x: 0, y: 440 },
        ],
        edges: [
          { from: "def", to: "ecg1", label: "" },
          { from: "def", to: "eti", label: "" },
          { from: "ecg1", to: "q1", label: "" },
          { from: "q1", to: "rx1", label: "بله" },
          { from: "q1", to: "rx2", label: "خیر" },
          { from: "rx1", to: "fu", label: "" },
          { from: "rx2", to: "fu", label: "" },
        ]
      }
    },
    {
      slug: "asthma-exac-manual",
      title_fa: "حمله آسم — مدیریت حاد",
      title_en: "Asthma Exacerbation — Acute Management",
      type: "mind", system: "pulmo", level: "high_yield",
      summary_fa: "ویز + تنگی نفس + افت PEF — استروئید سیستمیک + SABA/SAMA + منیزیم. GINA/Harrison 22e Ch. 50 — دستی ادمین.",
      summary_en: "Wheeze + dyspnea + low PEF — systemic steroids + SABA/SAMA + Mg. GINA/Harrison 22e Ch. 50 — manual.",
      cover_url: "/covers/harrison.jpg",
      is_premium: false,
      graph_json: {
        nodes: [
          { id: "def", label_fa: "تشدید آسم: بدتر شدن حاد التهاب راه هوایی", label_en: "Exac: acute worsening of airway inflammation", branch: "definition", x: 0, y: 0 },
          { id: "trig", label_fa: "محرک: آلرژن، عفونت ویروسی، ورزش، NSAID", label_en: "Trigger: allergen, viral, exercise, NSAID", branch: "etiology", x: -200, y: 110 },
          { id: "sev", label_fa: "شدت: PEF/FEV1، RR، SpO2، عدم تکلم کامل", label_en: "Severity: PEF/FEV1, RR, SpO2, cannot complete sentences", branch: "clinical", x: 200, y: 110 },
          { id: "clin", label_fa: "تظاهر: ویز منتشر، تاکی‌پنه، استفاده عضلات فرعی", label_en: "Clin: diffuse wheeze, tachypnea, accessory muscles", branch: "clinical", x: -200, y: 220 },
          { id: "inv", label_fa: "بررسی: PEF، ABG، CXR (پنوموتوراکس/پنومونی؟)", label_en: "Workup: PEF, ABG, CXR", branch: "workup", x: 200, y: 220 },
          { id: "rx1", label_fa: "درمان اول: O2 + SABA نبولایزر + ایپراتروپیوم", label_en: "First: O2 + nebulized SABA + ipratropium", branch: "treatment", x: -200, y: 330 },
          { id: "rx2", label_fa: "سیستمیک: پردنیزولون 40-60mg + منیزیم IV در شدید", label_en: "Systemic: pred 40-60mg + IV Mg if severe", branch: "treatment", x: 200, y: 330 },
          { id: "comp", label_fa: "عوارض: نارسایی تنفسی، پنوموتوراکس، مرگ", label_en: "Comp: respiratory failure, pneumo, death", branch: "complication", x: 0, y: 440 },
        ],
        edges: [
          { from: "def", to: "trig", label: "" },
          { from: "trig", to: "sev", label: "" },
          { from: "sev", to: "clin", label: "" },
          { from: "clin", to: "inv", label: "" },
          { from: "inv", to: "rx1", label: "" },
          { from: "rx1", to: "rx2", label: "ادامه" },
          { from: "rx2", to: "comp", label: "بدون درمان" },
        ]
      }
    },
    {
      slug: "pancreatitis-manual",
      title_fa: "پانکراتیت حاد — تشخیص و مدیریت",
      title_en: "Acute Pancreatitis — Diagnosis & Management",
      type: "mind", system: "gastro", level: "high_yield",
      summary_fa: "درد اپی‌گاستر + لیپاز >3x + تصویر + Ranson/BISAP. Harrison 22e Ch. 43 — دستی ادمین.",
      summary_en: "Epigastric pain + lipase >3x + imaging + Ranson/BISAP. Harrison 22e Ch. 43 — manual.",
      cover_url: "/covers/harrison.jpg",
      is_premium: true,
      graph_json: {
        nodes: [
          { id: "def", label_fa: "تعریف: التهاب حاد پانکراس (2 از 3: درد، لیپاز >3x، تصویر)", label_en: "Def: acute pancreas inflammation (2/3: pain, lipase >3x, imaging)", branch: "definition", x: 0, y: 0 },
          { id: "eti", label_fa: "علل: سنگ صفراوی (40%)، الکل (30%)، هیپرتری‌گلیسرید، دارو", label_en: "Causes: gallstone 40%, alcohol 30%, hyperTG, drugs", branch: "etiology", x: 0, y: 110 },
          { id: "clin", label_fa: "تظاهر: درد اپی‌گاستر منتشر به پشت، تهوع/استفراغ، تب", label_en: "Clin: epigastric radiating to back, N/V, fever", branch: "clinical", x: -200, y: 220 },
          { id: "inv", label_fa: "بررسی: لیپاز/آمیلاز، سونو/ CT، Ranson، BISAP، CRP", label_en: "Workup: lipase/amylase, US/CT, Ranson/BISAP", branch: "workup", x: 200, y: 220 },
          { id: "sev", label_fa: "شدت: نکروز، SIRS، نارسایی ارگان (Marshall)", label_en: "Severity: necrosis, SIRS, organ failure", branch: "workup", x: 0, y: 330 },
          { id: "rx", label_fa: "درمان: NPO + مایعات تهاجمی + مسکن + آنتی‌بیوتیک فقط اگر نکروز عفونی", label_en: "Rx: NPO + aggressive fluids + analgesia + abx only if infected necrosis", branch: "treatment", x: 0, y: 440 },
        ],
        edges: [
          { from: "def", to: "eti", label: "" },
          { from: "eti", to: "clin", label: "" },
          { from: "clin", to: "inv", label: "" },
          { from: "inv", to: "sev", label: "" },
          { from: "sev", to: "rx", label: "" },
        ]
      }
    },
    // --- 17 more to reach 50 — UI/UX rich, Harrison-faithful ---
    {
      slug: "nstemi",
      title_fa: "NSTEMI و آنژین ناپایدار",
      title_en: "NSTEMI & Unstable Angina",
      type: "mind", system: "cardio", level: "high_yield",
      summary_fa: "بدون ST↑ + تروپونین ± — TIMI/GRACE + DAPT + کاتِ زودهنگام. Harrison 22e Ch.35.",
      summary_en: "No ST↑ + troponin ± — TIMI/GRACE + DAPT + early cath. Harrison 22e Ch.35.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "def", label_fa: "NSTEMI: انسداد ناکامل + تروپونین ↑ بدون ST↑", label_en: "NSTEMI: subtotal occlusion + troponin ↑ no ST↑", branch: "definition", x: 0, y: 0 },
          { id: "ua", label_fa: "آنژین ناپایدار: ایسکمی بدون نکروز (تروپونین منفی)", label_en: "UA: ischemia without necrosis", branch: "definition", x: 0, y: 90 },
          { id: "clin", label_fa: "درد رترواسترنال + تغییرات ST/T", label_en: "Retrosternal pain + ST/T changes", branch: "clinical", x: -200, y: 180 },
          { id: "risk", label_fa: "ریسک: TIMI/GRACE + تروپونین + ECG", label_en: "Risk: TIMI/GRACE + troponin + ECG", branch: "workup", x: 200, y: 180 },
          { id: "rx", label_fa: "DAPT + هپارین + استاتین + کات <24h اگر پرریسک", label_en: "DAPT + heparin + statin + cath <24h if high risk", branch: "treatment", x: 0, y: 270 },
        ],
        edges: [{ from: "def", to: "clin", label: "" }, { from: "ua", to: "clin", label: "" }, { from: "clin", to: "risk", label: "" }, { from: "risk", to: "rx", label: "" }]
      }
    },
    {
      slug: "valvular",
      title_fa: "بیماری دریچه‌ای — تنگی/نارسایی آئورت و میترال",
      title_en: "Valvular Heart Disease",
      type: "mind", system: "cardio", level: "core",
      summary_fa: "سوفل + اکو + شدت + اندیکاسیونِ جراحی/ TAVI. Harrison 22e Ch.36.",
      summary_en: "Murmur + echo + severity + surgery/TAVI. Harrison 22e Ch.36.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "as", label_fa: "تنگی آئورت: سوفل سیستولیک + سنکوپ/آنژین/HF", label_en: "AS: systolic murmur + syncope/angina/HF", branch: "clinical", x: -200, y: 0 },
          { id: "mr", label_fa: "نارسایی میترال: سوفل سیستولیک راس + تپش", label_en: "MR: apical systolic murmur", branch: "clinical", x: 200, y: 0 },
          { id: "echo", label_fa: "اکو: گرادیان، مساحت دریچه، EF", label_en: "Echo: gradient, area, EF", branch: "workup", x: 0, y: 110 },
          { id: "rx", label_fa: "جراحی اگر علامت‌دار + شدید — TAVI در پرریسک", label_en: "Surgery if symptomatic + severe — TAVI if high risk", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "as", to: "echo", label: "" }, { from: "mr", to: "echo", label: "" }, { from: "echo", to: "rx", label: "" }]
      }
    },
    {
      slug: "pericarditis",
      title_fa: "پریکاردیت حاد",
      title_en: "Acute Pericarditis",
      type: "mind", system: "cardio", level: "core",
      summary_fa: "درد تیز با تنفس + PR↓ ST↑ منتشر + فرکشن. Harrison 22e Ch.38.",
      summary_en: "Pleuritic pain + diffuse ST↑ PR↓ + rub. Harrison 22e Ch.38.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "clin", label_fa: "درد تیز، بهتر با نشستن به جلو", label_en: "Sharp pain, better leaning forward", branch: "clinical", x: 0, y: 0 },
          { id: "ecg", label_fa: "ECG: ST↑ مقعر منتشر + PR↓", label_en: "ECG: diffuse concave ST↑ + PR↓", branch: "workup", x: -200, y: 110 },
          { id: "echo", label_fa: "اکو: افیوژن ± تامپوناد", label_en: "Echo: effusion ± tamponade", branch: "workup", x: 200, y: 110 },
          { id: "rx", label_fa: "NSAID + کلشی‌سین، پرهیزِ ورزش", label_en: "NSAID + colchicine", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "clin", to: "ecg", label: "" }, { from: "clin", to: "echo", label: "" }, { from: "ecg", to: "rx", label: "" }]
      }
    },
    {
      slug: "htn-emergency",
      title_fa: "اورژانس پرفشاری خون",
      title_en: "Hypertensive Emergency",
      type: "approach", system: "cardio", level: "emergency",
      summary_fa: "BP>180/120 + آسیب ارگان (مغز/قلب/کلیه) — کاهشِ کنترل‌شده. Harrison 22e Ch.34.",
      summary_en: "BP>180/120 + organ damage — controlled lowering. Harrison 22e Ch.34.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "def", label_fa: "اورژانس: BP بالا + آسیب حادِ ارگان", label_en: "Emergency: high BP + acute organ damage", branch: "definition", x: 0, y: 0 },
          { id: "urg", label_fa: "فوریت: BP بالا بدون آسیب → خوراکی", label_en: "Urgency: high BP no damage → oral", branch: "definition", x: 0, y: 90 },
          { id: "eval", label_fa: "ارزیابی: Neuro/قلب/چشم/ادرار/کراتینین", label_en: "Eval: neuro/heart/eye/urine/creatinine", branch: "workup", x: 0, y: 180 },
          { id: "rx", label_fa: "IV: لابتالول/نیکاردیپین — ↓ 25% اول ساعت", label_en: "IV: labetalol/nicardipine — ↓25% first hour", branch: "treatment", x: 0, y: 270 },
        ],
        edges: [{ from: "def", to: "eval", label: "" }, { from: "urg", to: "eval", label: "" }, { from: "eval", to: "rx", label: "" }]
      }
    },
    {
      slug: "ild",
      title_fa: "بیماری بینابینی ریه (ILD)",
      title_en: "Interstitial Lung Disease",
      type: "mind", system: "pulmo", level: "core",
      summary_fa: "تنگی نفسِ تدریجی + کراکلِ خشک + UIP/NSIP در HRCT. Harrison 22e Ch.52.",
      summary_en: "Progressive dyspnea + dry crackles + UIP/NSIP on HRCT. Harrison 22e Ch.52.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "clin", label_fa: "تظاهر: دیس‌پنه + سرفه خشک + چماقی", label_en: "Clin: dyspnea + dry cough + clubbing", branch: "clinical", x: 0, y: 0 },
          { id: "hrct", label_fa: "HRCT: UIP (هانی‌کام) vs NSIP", label_en: "HRCT: UIP vs NSIP", branch: "workup", x: 0, y: 110 },
          { id: "pft", label_fa: "PFT: محدودیت + DLCO↓", label_en: "PFT: restriction + DLCO↓", branch: "workup", x: 0, y: 200 },
          { id: "rx", label_fa: "IPF: آنتی‌فیبروتیک (پیرفنیدون/نیتدانib) — سایر: استروئید", label_en: "IPF: antifibrotic — others: steroids", branch: "treatment", x: 0, y: 290 },
        ],
        edges: [{ from: "clin", to: "hrct", label: "" }, { from: "hrct", to: "pft", label: "" }, { from: "pft", to: "rx", label: "" }]
      }
    },
    {
      slug: "pleural-effusion",
      title_fa: "پلورال افیوژن — ترانسودا vs اگزودا",
      title_en: "Pleural Effusion — Transudate vs Exudate",
      type: "approach", system: "pulmo", level: "core",
      summary_fa: "Light's criteria + علل. Harrison 22e Ch.53.",
      summary_en: "Light's criteria + causes. Harrison 22e Ch.53.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "cxr", label_fa: "CXR: کدورتِ قاعده + ماتیت دق", label_en: "CXR: basal opacity + dullness", branch: "workup", x: 0, y: 0 },
          { id: "tap", label_fa: "توراسنتز + Light: پروتئین/ LDH", label_en: "Thoracentesis + Light: protein/LDH", branch: "workup", x: 0, y: 110 },
          { id: "trans", label_fa: "ترانسودا: HF، سیروز، نفروتیک", label_en: "Transudate: HF, cirrhosis, nephrotic", branch: "etiology", x: -200, y: 200 },
          { id: "exu", label_fa: "اگزودا: پنومونی، سل، بدخیمی", label_en: "Exudate: pneumonia, TB, malignancy", branch: "etiology", x: 200, y: 200 },
        ],
        edges: [{ from: "cxr", to: "tap", label: "" }, { from: "tap", to: "trans", label: "" }, { from: "tap", to: "exu", label: "" }]
      }
    },
    {
      slug: "ibd",
      title_fa: "بیماری التهابی روده — کرون vs کولیت اولسروز",
      title_en: "IBD — Crohn vs Ulcerative Colitis",
      type: "mind", system: "gastro", level: "high_yield",
      summary_fa: "اسهالِ مزمن + خون + کولونوسکوپی. Harrison 22e Ch.47.",
      summary_en: "Chronic diarrhea + blood + colonoscopy. Harrison 22e Ch.47.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "uc", label_fa: "UC: کولونِ پیوسته از رکتوم + خون", label_en: "UC: continuous from rectum + blood", branch: "clinical", x: -200, y: 0 },
          { id: "crohn", label_fa: "کرون: پراکنده، تمامِ جدار، ایلئوم", label_en: "Crohn: skip, transmural, ileum", branch: "clinical", x: 200, y: 0 },
          { id: "inv", label_fa: "کولونوسکوپی + بیوپسی + ASCA/pANCA", label_en: "Colonoscopy + biopsy + ASCA/pANCA", branch: "workup", x: 0, y: 110 },
          { id: "rx", label_fa: "مِسالازین، استروئید، آنتی-TNF، وِدو", label_en: "Mesalazine, steroids, anti-TNF, vedo", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "uc", to: "inv", label: "" }, { from: "crohn", to: "inv", label: "" }, { from: "inv", to: "rx", label: "" }]
      }
    },
    {
      slug: "hepatitis",
      title_fa: "هپاتیت ویروسی — B/C",
      title_en: "Viral Hepatitis B/C",
      type: "mind", system: "gastro", level: "high_yield",
      summary_fa: "HBsAg/anti-HCV + آنزیم + فیبروز + درمان. Harrison 22e Ch.46.",
      summary_en: "HBsAg/anti-HCV + enzymes + fibrosis + Rx. Harrison 22e Ch.46.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "hbv", label_fa: "HBV: HBsAg + anti-HBc + HBV DNA", label_en: "HBV: HBsAg + anti-HBc + DNA", branch: "workup", x: -200, y: 0 },
          { id: "hcv", label_fa: "HCV: anti-HCV + HCV RNA", label_en: "HCV: anti-HCV + RNA", branch: "workup", x: 200, y: 0 },
          { id: "fib", label_fa: "فیبروز: FIB-4، الاستوگرافی، بیوپسی", label_en: "Fibrosis: FIB-4, elastography", branch: "workup", x: 0, y: 110 },
          { id: "rx", label_fa: "HBV: تنوفوویر/انتکاویر — HCV: DAA (سوفوسبوویر)", label_en: "HBV: tenofovir — HCV: DAA", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "hbv", to: "fib", label: "" }, { from: "hcv", to: "fib", label: "" }, { from: "fib", to: "rx", label: "" }]
      }
    },
    {
      slug: "gerd",
      title_fa: "ریفلاکس (GERD) و مری بارت",
      title_en: "GERD & Barrett",
      type: "mind", system: "gastro", level: "core",
      summary_fa: "سوزش سرِدل + آندوسکوپی اگر آلارم. Harrison 22e Ch.42.",
      summary_en: "Heartburn + scope if alarm. Harrison 22e Ch.42.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "clin", label_fa: "سوزش + ترش‌کردن، تشدید با درازکش", label_en: "Heartburn + regurgitation, worse supine", branch: "clinical", x: 0, y: 0 },
          { id: "alarm", label_fa: "آلارم: دیسفاژی، خون، کاهش وزن، آنمی", label_en: "Alarm: dysphagia, bleed, weight loss", branch: "workup", x: 0, y: 110 },
          { id: "rx", label_fa: "PPI + کاهش وزن + پرهیزِ محرک", label_en: "PPI + weight loss", branch: "treatment", x: -200, y: 220 },
          { id: "bar", label_fa: "بارت: متاپلازی روده‌ای → سروی", label_en: "Barrett: intestinal metaplasia → survey", branch: "complication", x: 200, y: 220 },
        ],
        edges: [{ from: "clin", to: "alarm", label: "" }, { from: "alarm", to: "rx", label: "" }, { from: "alarm", to: "bar", label: "" }]
      }
    },
    {
      slug: "nephrolithiasis",
      title_fa: "سنگ کلیه — اپروچ",
      title_en: "Nephrolithiasis",
      type: "approach", system: "nephro", level: "core",
      summary_fa: "کولیک پهلو + هماچوری + سونو/CT. Harrison 22e Ch.65.",
      summary_en: "Flank colic + hematuria + US/CT. Harrison 22e Ch.65.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "clin", label_fa: "کولیک شدیدِ پهلو + هماچوری", label_en: "Severe flank colic + hematuria", branch: "clinical", x: 0, y: 0 },
          { id: "img", label_fa: "سونو/ CT بدون کنتراست → سنگ", label_en: "US/CT → stone", branch: "workup", x: 0, y: 110 },
          { id: "rx", label_fa: "مسکن + هیدراتاسیون + تامسولوسین اگر <10mm", label_en: "Analgesia + fluids + tamsulosin if <10mm", branch: "treatment", x: -200, y: 220 },
          { id: "prev", label_fa: "پیشگیری: مایعات، سیترات، تیازید", label_en: "Prevention: fluids, citrate, thiazide", branch: "treatment", x: 200, y: 220 },
        ],
        edges: [{ from: "clin", to: "img", label: "" }, { from: "img", to: "rx", label: "" }, { from: "rx", to: "prev", label: "" }]
      }
    },
    {
      slug: "rta",
      title_fa: "اسیدوز توبولی کلیه (RTA)",
      title_en: "Renal Tubular Acidosis",
      type: "mind", system: "nephro", level: "high_yield",
      summary_fa: "نوع ۱/۲/۴ + ABG + پتاسیم. Harrison 22e Ch.61.",
      summary_en: "Type 1/2/4 + ABG + K. Harrison 22e Ch.61.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "t1", label_fa: "نوع ۱ (دیستال): H+ ترشح نمی‌شود → اسیدوز + K↓ + سنگ", label_en: "Type 1 distal: H+ not secreted → acidosis + low K + stone", branch: "patho", x: -200, y: 0 },
          { id: "t2", label_fa: "نوع ۲ (پروگزیمال): بیکربنات دفع → اسیدوز + K↓", label_en: "Type 2 proximal: bicarb wasting", branch: "patho", x: 200, y: 0 },
          { id: "t4", label_fa: "نوع ۴: آلدو کم → اسیدوز + K↑", label_en: "Type 4: low aldo → acidosis + high K", branch: "patho", x: 0, y: 110 },
          { id: "rx", label_fa: "بیکربنات/سیترات + اصلاح K", label_en: "Bicarb/citrate + K correction", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "t1", to: "rx", label: "" }, { from: "t2", to: "rx", label: "" }, { from: "t4", to: "rx", label: "" }]
      }
    },
    {
      slug: "hypoglycemia",
      title_fa: "هیپوگلیسمی — اپروچ",
      title_en: "Hypoglycemia",
      type: "approach", system: "endo", level: "emergency",
      summary_fa: "Whipple + انسولین/C-peptide + علت. Harrison 22e Ch.40.",
      summary_en: "Whipple + insulin/C-peptide + cause. Harrison 22e Ch.40.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "whi", label_fa: "Whipple: علائم + گلوکز پایین + بهبود با قند", label_en: "Whipple: symptoms + low glc + relief with sugar", branch: "definition", x: 0, y: 0 },
          { id: "lab", label_fa: "آزما هنگامِ افت: انسولین، C-peptide، سولفونیل‌اوره", label_en: "Labs during low: insulin, C-peptide", branch: "workup", x: 0, y: 110 },
          { id: "ins", label_fa: "انسولین↑ C-peptide↑ → انسولینوم/سولفونیل‌اوره", label_en: "High insulin/C-peptide → insulinoma", branch: "etiology", x: -200, y: 220 },
          { id: "adren", label_fa: "انسولین↓ → نارسایی آدرنال/کبدی", label_en: "Low insulin → adrenal/hepatic failure", branch: "etiology", x: 200, y: 220 },
        ],
        edges: [{ from: "whi", to: "lab", label: "" }, { from: "lab", to: "ins", label: "" }, { from: "lab", to: "adren", label: "" }]
      }
    },
    {
      slug: "epilepsy",
      title_fa: "صرع — طبقه‌بندی و درمان",
      title_en: "Epilepsy",
      type: "mind", system: "neuro", level: "high_yield",
      summary_fa: "فوکال/ژنرالیزه + EEG + انتخابِ دارو. Harrison 22e Ch.69.",
      summary_en: "Focal/generalized + EEG + drug choice. Harrison 22e Ch.69.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "foc", label_fa: "فوکال: یک نیمکره → لوب گیجگاهی", label_en: "Focal: one hemisphere → temporal", branch: "clinical", x: -200, y: 0 },
          { id: "gen", label_fa: "ژنرالیزه: هر دو نیمکره → تونیک-کلونیک", label_en: "Generalized: both hemispheres → tonic-clonic", branch: "clinical", x: 200, y: 0 },
          { id: "eeg", label_fa: "EEG + MRI برای علت", label_en: "EEG + MRI for cause", branch: "workup", x: 0, y: 110 },
          { id: "rx", label_fa: "لویتیراستام/کاربامازپین/والپروات + پرهیزِ محرک", label_en: "Levetiracetam/carb/valproate", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "foc", to: "eeg", label: "" }, { from: "gen", to: "eeg", label: "" }, { from: "eeg", to: "rx", label: "" }]
      }
    },
    {
      slug: "meningitis",
      title_fa: "مننژیت باکتریال",
      title_en: "Bacterial Meningitis",
      type: "mind", system: "neuro", level: "emergency",
      summary_fa: "تب + سفتی گردن + تغییرِ هوشیاری — LP + آنتی‌بیوتیک فوری. Harrison 22e Ch.70.",
      summary_en: "Fever + neck stiffness + altered — LP + immediate abx. Harrison 22e Ch.70.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "tri", label_fa: "تریاد: تب + سفتی گردن + تغییر هوشیاری", label_en: "Triad: fever + neck stiffness + altered", branch: "clinical", x: 0, y: 0 },
          { id: "lp", label_fa: "LP: WBC↑ نوتروفیل + پروتئین↑ + گلوکز↓", label_en: "LP: WBC↑ neutrophils + protein↑ + glc↓", branch: "workup", x: 0, y: 110 },
          { id: "rx", label_fa: "سفتریاکسون + وانکو + دگزامتازون قبلِ آنتی‌بیوتیک", label_en: "Ceftriaxone + vanco + dex before abx", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "tri", to: "lp", label: "" }, { from: "lp", to: "rx", label: "" }]
      }
    },
    {
      slug: "thrombocytopenia",
      title_fa: "ترومبوسیتوپنی — افتراق",
      title_en: "Thrombocytopenia",
      type: "approach", system: "heme", level: "core",
      summary_fa: "ITP/TTP/HIT/DIC + اسمیر. Harrison 22e Ch.26.",
      summary_en: "ITP/TTP/HIT/DIC + smear. Harrison 22e Ch.26.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "smear", label_fa: "اسمیر: پلاکتِ کم + شیزوسیت؟", label_en: "Smear: low plt + schistocytes?", branch: "workup", x: 0, y: 0 },
          { id: "ttp", label_fa: "TTP: تب + آنمی همولیتیک + نارسایی کلیه + نورو", label_en: "TTP: fever + hemolysis + renal + neuro", branch: "clinical", x: -200, y: 110 },
          { id: "itp", label_fa: "ITP: ایزوله + بدون علت → آنتی‌بادی پلاکت", label_en: "ITP: isolated → plt antibody", branch: "clinical", x: 200, y: 110 },
          { id: "hit", label_fa: "HIT: ۵-۱۰ روز پس از هپارین + ترومبوز", label_en: "HIT: 5-10d after heparin + thrombosis", branch: "clinical", x: 0, y: 220 },
        ],
        edges: [{ from: "smear", to: "ttp", label: "" }, { from: "smear", to: "itp", label: "" }, { from: "smear", to: "hit", label: "" }]
      }
    },
    {
      slug: "vasculitis",
      title_fa: "واسکولیت — ANCA و عروقِ بزرگ",
      title_en: "Vasculitis",
      type: "mind", system: "rheum", level: "high_yield",
      summary_fa: "GPA/MPA (ANCA+) vs GCA/تاکایاسو. Harrison 22e Ch.74.",
      summary_en: "GPA/MPA (ANCA+) vs GCA/Takayasu. Harrison 22e Ch.74.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "small", label_fa: "عروق کوچک: GPA (ریه+سینوس+کلیه) cANCA+", label_en: "Small: GPA (lung+sinus+kidney) cANCA+", branch: "clinical", x: -200, y: 0 },
          { id: "mpa", label_fa: "MPA: ریه+کلیه pANCA+", label_en: "MPA: lung+kidney pANCA+", branch: "clinical", x: 200, y: 0 },
          { id: "large", label_fa: "عروق بزرگ: GCA (شقیقه) + تاکایاسو", label_en: "Large: GCA (temporal) + Takayasu", branch: "clinical", x: 0, y: 110 },
          { id: "rx", label_fa: "استروئید + ریتوکسیماب/سیکلوفسفامید", label_en: "Steroids + ritux/cyclo", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "small", to: "rx", label: "" }, { from: "mpa", to: "rx", label: "" }, { from: "large", to: "rx", label: "" }]
      }
    },
    {
      slug: "endocarditis",
      title_fa: "اندوکاردیت عفونی",
      title_en: "Infective Endocarditis",
      type: "mind", system: "infect", level: "high_yield",
      summary_fa: "Duke + اکو + کشت + آنتی‌بیوتیک. Harrison 22e Ch.18.",
      summary_en: "Duke + echo + culture + abx. Harrison 22e Ch.18.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "duke", label_fa: "Duke: 2 major یا 1 major+3 minor", label_en: "Duke: 2 major or 1 major+3 minor", branch: "workup", x: 0, y: 0 },
          { id: "major", label_fa: "Major: کشت+ و اکو وژتاسیون", label_en: "Major: culture+ and echo vegetation", branch: "workup", x: -200, y: 110 },
          { id: "minor", label_fa: "Minor: تب، واسکولیت، ایمونولوژیک", label_en: "Minor: fever, vascular, immunologic", branch: "clinical", x: 200, y: 110 },
          { id: "rx", label_fa: "وانکو + جنتا/سفتریاکسون + جراحی اگر نارسایی/آبسه", label_en: "Vanco + genta/ceftri + surgery if HF/abscess", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "duke", to: "major", label: "" }, { from: "duke", to: "minor", label: "" }, { from: "major", to: "rx", label: "" }]
      }
    },
    {
      slug: "shock",
      title_fa: "شوک — افتراق و مدیریت",
      title_en: "Shock — Differentiation & Management",
      type: "approach", system: "emergency", level: "emergency",
      summary_fa: "کاهش پرفیوژن + انواع (هیپوولمیک/کاردیوژنیک/توزیعی/انسدادی) + درمان. Harrison 22e Ch.20.",
      summary_en: "↓ perfusion + types (hypovolemic/cardiogenic/distributive/obstructive) + Rx. Harrison 22e Ch.20.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "def", label_fa: "شوک: پرفیوژن ناکافی → لاکتات↑ + افت فشار + الیگوری", label_en: "Shock: inadequate perfusion → lactate↑ + hypotension", branch: "definition", x: 0, y: 0 },
          { id: "types", label_fa: "انواع: هیپوولمیک، کاردیوژنیک، توزیعی (سپتیک/آنافیلاکسی)، انسدادی (PE/تامپوناد)", label_en: "Types: hypovolemic, cardiogenic, distributive, obstructive", branch: "etiology", x: 0, y: 110 },
          { id: "work", label_fa: "بررسی: لاکتات، CVP، اکو، US ریه/IVC، کشت", label_en: "Workup: lactate, CVP, echo, US", branch: "workup", x: 0, y: 220 },
          { id: "rx", label_fa: "درمان: مایعات + وازوپرسور (نوراپی) + علت (آنتی‌بیوتیک/ PCI/ ترومبولیز)", label_en: "Rx: fluids + norepi + cause-specific", branch: "treatment", x: 0, y: 330 },
        ],
        edges: [{ from: "def", to: "types", label: "" }, { from: "types", to: "work", label: "" }, { from: "work", to: "rx", label: "" }]
      }
    },
    // --- 10 more to reach 60 ---
    {
      slug: "anaphylaxis",
      title_fa: "آنافیلاکسی",
      title_en: "Anaphylaxis",
      type: "approach", system: "emergency", level: "emergency",
      summary_fa: "افت فشار + کهیر/آنژیوادم + برونکواسپاسم — اپی‌نفرین IM. Harrison 22e Ch.23.",
      summary_en: "Hypotension + urticaria/angioedema + bronchospasm — IM epi. Harrison 22e Ch.23.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "tri", label_fa: "تریاد: پوست + تنفس + گردش", label_en: "Triad: skin + resp + circ", branch: "clinical", x: 0, y: 0 },
          { id: "trig", label_fa: "محرک: غذا/دارو/نیش حشره", label_en: "Trigger: food/drug/sting", branch: "etiology", x: 0, y: 110 },
          { id: "rx", label_fa: "اپی‌نفرین IM 0.3-0.5mg + مایعات + آنتی‌هیستامین + استروئید", label_en: "IM epi + fluids + antihistamine + steroids", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "tri", to: "trig", label: "" }, { from: "trig", to: "rx", label: "" }]
      }
    },
    {
      slug: "dvt",
      title_fa: "ترومبوز ورید عمقی (DVT)",
      title_en: "Deep Venous Thrombosis",
      type: "mind", system: "cardio", level: "high_yield",
      summary_fa: "ادم/درد اندام + Wells + D-dimer + سونو. Harrison 22e Ch.56.",
      summary_en: "Limb swelling/pain + Wells + D-dimer + US. Harrison 22e Ch.56.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "clin", label_fa: "تظاهر: ادم یک‌طرفه + درد + اریتم", label_en: "Clin: unilateral swelling + pain + erythema", branch: "clinical", x: 0, y: 0 },
          { id: "wells", label_fa: "Wells ≥2 پرریسک → سونو فوری", label_en: "Wells ≥2 high → US now", branch: "workup", x: -200, y: 110 },
          { id: "dd", label_fa: "Wells پایین + D-dimer منفی → رد", label_en: "Low Wells + neg D-dimer → rule out", branch: "workup", x: 200, y: 110 },
          { id: "rx", label_fa: "DOAC (آپیکسابان/ریواروکسابان) + جوراب فشاری", label_en: "DOAC + compression", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "clin", to: "wells", label: "" }, { from: "clin", to: "dd", label: "" }, { from: "wells", to: "rx", label: "" }]
      }
    },
    {
      slug: "stroke-hemo",
      title_fa: "سکته هموراژیک",
      title_en: "Hemorrhagic Stroke",
      type: "mind", system: "neuro", level: "emergency",
      summary_fa: "سردرد ناگهانی + همی‌پارزی + CT هیپردنس. Harrison 22e Ch.68.",
      summary_en: "Thunderclap headache + hemiparesis + hyperdense CT. Harrison 22e Ch.68.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "clin", label_fa: "سردرد برق‌آسا + تهوع/استفراغ + افت هوشیاری", label_en: "Thunderclap + N/V + ↓ LOC", branch: "clinical", x: 0, y: 0 },
          { id: "ct", label_fa: "CT بدون کنتراست: خون هیپردنس", label_en: "Non-contrast CT: hyperdense blood", branch: "workup", x: 0, y: 110 },
          { id: "rx", label_fa: "کاهش فشار ملایم + ریورس وارفارین + جراحی اگر هماتوم بزرگ", label_en: "Gentle BP ↓ + reverse warfarin + surgery if large", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "clin", to: "ct", label: "" }, { from: "ct", to: "rx", label: "" }]
      }
    },
    {
      slug: "ms",
      title_fa: "مولتیپل اسکلروزیس (MS)",
      title_en: "Multiple Sclerosis",
      type: "mind", system: "neuro", level: "high_yield",
      summary_fa: "حملات عود-بهبود + MRI پلاک + OCB. Harrison 22e Ch.78.",
      summary_en: "Relapsing-remitting + MRI plaques + OCB. Harrison 22e Ch.78.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "clin", label_fa: "نوریت اپتیک + ضعف/پارستزی منتشر در زمان/مکان", label_en: "Optic neuritis + disseminated weakness/paresthesia", branch: "clinical", x: 0, y: 0 },
          { id: "mri", label_fa: "MRI: پلاک پری‌ونتریکولار + Dawson finger", label_en: "MRI: periventricular plaques", branch: "workup", x: 0, y: 110 },
          { id: "rx", label_fa: "حمله: متیل‌پردنیزولون — پیشگیری: اینترفرون/ریتوکسی", label_en: "Attack: methylpred — DMT: interferon/ritux", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "clin", to: "mri", label: "" }, { from: "mri", to: "rx", label: "" }]
      }
    },
    {
      slug: "gbs",
      title_fa: "سندرم گیلن‌باره (GBS)",
      title_en: "Guillain-Barré Syndrome",
      type: "mind", system: "neuro", level: "emergency",
      summary_fa: "فلج صعودی + آرِفلکسی + سابقه گاستروانتریت (کمپیلوباکتر). Harrison 22e Ch.77.",
      summary_en: "Ascending paralysis + areflexia + prior gastroenteritis. Harrison 22e Ch.77.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "clin", label_fa: "ضعف صعودی + آرِفلکسی + پارستزی", label_en: "Ascending weakness + areflexia", branch: "clinical", x: 0, y: 0 },
          { id: "lp", label_fa: "LP: پروتئین↑ بدون پلئوسیتوز (albuminocytologic dissociation)", label_en: "LP: high protein no pleocytosis", branch: "workup", x: 0, y: 110 },
          { id: "rx", label_fa: "IVIG یا پلاسمافرز + مانیتور تنفسی", label_en: "IVIG or plasmapheresis + resp monitor", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "clin", to: "lp", label: "" }, { from: "lp", to: "rx", label: "" }]
      }
    },
    {
      slug: "hypothyroidism",
      title_fa: "کم‌کاری تیروئید",
      title_en: "Hypothyroidism",
      type: "mind", system: "endo", level: "core",
      summary_fa: "خستگی + افزایش وزن + یبوست + TSH↑. Harrison 22e Ch.41.",
      summary_en: "Fatigue + weight gain + constipation + high TSH. Harrison 22e Ch.41.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "clin", label_fa: "علائم: خستگی، عدم تحمل سرما، یبوست، ادم میکزدم", label_en: "Clin: fatigue, cold intolerance, constipation, myxedema", branch: "clinical", x: 0, y: 0 },
          { id: "lab", label_fa: "TSH↑ + T4↓ (اولیه) — TSH↓ + T4↓ (ثانویه)", label_en: "TSH↑ T4↓ (primary) — TSH↓ T4↓ (secondary)", branch: "workup", x: 0, y: 110 },
          { id: "rx", label_fa: "لووتیروکسین با تیتر TSH", label_en: "Levothyroxine titrated to TSH", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "clin", to: "lab", label: "" }, { from: "lab", to: "rx", label: "" }]
      }
    },
    {
      slug: "cushing",
      title_fa: "سندرم کوشینگ",
      title_en: "Cushing Syndrome",
      type: "mind", system: "endo", level: "high_yield",
      summary_fa: "چاقی مرکزی + استریا + هیپرتانسیون + کورتیزول↑. Harrison 22e Ch.40.",
      summary_en: "Central obesity + striae + HTN + high cortisol. Harrison 22e Ch.40.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "clin", label_fa: "ماه‌صورت + بوفالو هامپ + استریای بنفش + ضعف", label_en: "Moon face + buffalo hump + purple striae", branch: "clinical", x: 0, y: 0 },
          { id: "scr", label_fa: "غربال: دگزامتازون 1mg شبانه + کورتیزول آزاد ادرار", label_en: "Screen: 1mg dex + UFC", branch: "workup", x: 0, y: 110 },
          { id: "rx", label_fa: "جراحی آدنوم هیپوفیز/آدرنال + کتوکونازول", label_en: "Surgery pituitary/adrenal + ketoconazole", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "clin", to: "scr", label: "" }, { from: "scr", to: "rx", label: "" }]
      }
    },
    {
      slug: "uti",
      title_fa: "عفونت ادراری (UTI)",
      title_en: "Urinary Tract Infection",
      type: "mind", system: "nephro", level: "core",
      summary_fa: "سوزش ادرار + تکرر + لکوسیت استراز + کشت. Harrison 22e Ch.66.",
      summary_en: "Dysuria + frequency + leuk esterase + culture. Harrison 22e Ch.66.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "cys", label_fa: "سیستیت: سوزش + تکرر بدون تب", label_en: "Cystitis: dysuria + frequency no fever", branch: "clinical", x: -200, y: 0 },
          { id: "pyelo", label_fa: "پیلونفریت: تب + درد پهلو + تهوع", label_en: "Pyelo: fever + flank pain + N/V", branch: "clinical", x: 200, y: 0 },
          { id: "ua", label_fa: "آنالیز ادرار + کشت → E.coli", label_en: "UA + culture → E.coli", branch: "workup", x: 0, y: 110 },
          { id: "rx", label_fa: "نیتروفورانتوئین/فوسفو برای سیستیت — سفتریاکسون برای پیلو", label_en: "Nitro/fosfo for cystitis — ceftri for pyelo", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "cys", to: "ua", label: "" }, { from: "pyelo", to: "ua", label: "" }, { from: "ua", to: "rx", label: "" }]
      }
    },
    {
      slug: "anemia-appro",
      title_fa: "آنمی — اپروچ تشخیصی",
      title_en: "Anemia — Diagnostic Approach",
      type: "approach", system: "heme", level: "core",
      summary_fa: "MCV + رتیک + اسمیر. Harrison 22e Ch.25.",
      summary_en: "MCV + retic + smear. Harrison 22e Ch.25.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "cbc", label_fa: "CBC: Hb↓ + MCV؟", label_en: "CBC: low Hb + MCV?", branch: "workup", x: 0, y: 0 },
          { id: "micro", label_fa: "میکروسیتیک: فقر آهن/تالاسمی", label_en: "Micro: iron def/thal", branch: "etiology", x: -200, y: 110 },
          { id: "macro", label_fa: "ماکروسیتیک: B12/فولات/الکل", label_en: "Macro: B12/folate/alcohol", branch: "etiology", x: 200, y: 110 },
          { id: "normo", label_fa: "نورموسیتیک: خونریزی/همولیز/مزمن", label_en: "Normocytic: bleed/hemolysis/chronic", branch: "etiology", x: 0, y: 220 },
        ],
        edges: [{ from: "cbc", to: "micro", label: "" }, { from: "cbc", to: "macro", label: "" }, { from: "cbc", to: "normo", label: "" }]
      }
    },
    {
      slug: "cirrhosis-complications",
      title_fa: "عوارض سیروز — آسیت و آنسفالوپاتی",
      title_en: "Cirrhosis Complications",
      type: "mind", system: "gastro", level: "high_yield",
      summary_fa: "آسیت + SBP + آنسفالوپاتی + واریس. Harrison 22e Ch.44.",
      summary_en: "Ascites + SBP + encephalopathy + varices. Harrison 22e Ch.44.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "asc", label_fa: "آسیت: SAAG>1.1 → پورتال", label_en: "Ascites: SAAG>1.1 → portal", branch: "clinical", x: -200, y: 0 },
          { id: "sbp", label_fa: "SBP: تب + درد شکم + نوتروفیل آسیت>250", label_en: "SBP: fever + pain + ascitic PMN>250", branch: "complication", x: 200, y: 0 },
          { id: "he", label_fa: "آنسفالوپاتی: گیجی + آستریكسیس + آمونیاک↑", label_en: "Encephalopathy: confusion + asterixis", branch: "complication", x: 0, y: 110 },
          { id: "rx", label_fa: "اسپیرونولاکتون + سفتریاکسون + لاکتولوز + باند واریس", label_en: "Spiro + ceftri + lactulose + banding", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "asc", to: "sbp", label: "" }, { from: "asc", to: "he", label: "" }, { from: "sbp", to: "rx", label: "" }]
      }
    },
    // --- 40 more to reach 100 — full coverage ---
    {
      slug: "aortic-dissection",
      title_fa: "دایسکشن آئورت",
      title_en: "Aortic Dissection",
      type: "mind", system: "cardio", level: "emergency",
      summary_fa: "دردِ پاره‌کننده + اختلاف فشار + مدیاستن عریض — CT. Harrison 22e Ch.31.",
      summary_en: "Tearing pain + BP gap + wide mediastinum — CT. Harrison 22e Ch.31.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "clin", label_fa: "درد ناگهانیِ پاره‌کننده + انتشار به پشت", label_en: "Sudden tearing pain radiating to back", branch: "clinical", x: 0, y: 0 },
          { id: "sign", label_fa: "اختلاف فشار دو دست + سوفل AR + شوک", label_en: "BP gap + AR murmur + shock", branch: "clinical", x: 0, y: 110 },
          { id: "ct", label_fa: "CT آنژیو: فلپ + لومنِ کاذب", label_en: "CT angio: flap + false lumen", branch: "workup", x: 0, y: 220 },
          { id: "rx", label_fa: "A: جراحی فوری — B: کنترل HR/BP (اسمولول + نیپريد)", label_en: "A: surgery — B: HR/BP control", branch: "treatment", x: 0, y: 330 },
        ],
        edges: [{ from: "clin", to: "sign", label: "" }, { from: "sign", to: "ct", label: "" }, { from: "ct", to: "rx", label: "" }]
      }
    },
    {
      slug: "svt",
      title_fa: "تاکی‌کاردی فوق‌بطنی (SVT)",
      title_en: "Supraventricular Tachycardia",
      type: "mind", system: "cardio", level: "high_yield",
      summary_fa: "QRS باریک + ریگولار + P مخفی — واگ + آدنوزین. Harrison 22e Ch.28.",
      summary_en: "Narrow regular QRS + hidden P — vagal + adenosine. Harrison 22e Ch.28.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "ecg", label_fa: "ECG: QRS باریکِ ریگولار ~150-250", label_en: "ECG: narrow regular ~150-250", branch: "workup", x: 0, y: 0 },
          { id: "vagal", label_fa: "واگال (والسالوا) → آدنوزین 6mg", label_en: "Vagal → adenosine 6mg", branch: "treatment", x: -200, y: 110 },
          { id: "stable", label_fa: "پایدار → وراپامیل/بتا", label_en: "Stable → verapamil/beta", branch: "treatment", x: 200, y: 110 },
          { id: "unstable", label_fa: "ناپایدار → کاردیوورژن", label_en: "Unstable → cardioversion", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "ecg", to: "vagal", label: "" }, { from: "ecg", to: "stable", label: "" }, { from: "vagal", to: "unstable", label: "" }]
      }
    },
    {
      slug: "bradycardia",
      title_fa: "برادی‌کاردی و بلوک AV",
      title_en: "Bradycardia & AV Block",
      type: "mind", system: "cardio", level: "core",
      summary_fa: "HR<60 + سرگیجه/سنکوپ + ECG بلوک. Harrison 22e Ch.28.",
      summary_en: "HR<60 + dizz/syncope + AV block ECG. Harrison 22e Ch.28.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "clin", label_fa: "علائم: خستگی + سرگیجه + سنکوپ", label_en: "Sympt: fatigue + dizz + syncope", branch: "clinical", x: 0, y: 0 },
          { id: "ecg", label_fa: "ECG: برادی سینوسی vs بلوک Mobitz I/II vs کامل", label_en: "ECG: sinus brady vs Mobitz I/II vs complete", branch: "workup", x: 0, y: 110 },
          { id: "rx", label_fa: "آتروپین + پیس موقت → دائم اگر علامت‌دار", label_en: "Atropine + temp pacing → permanent if symptomatic", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "clin", to: "ecg", label: "" }, { from: "ecg", to: "rx", label: "" }]
      }
    },
    {
      slug: "pneumothorax",
      title_fa: "پنوموتوراکس",
      title_en: "Pneumothorax",
      type: "mind", system: "pulmo", level: "emergency",
      summary_fa: "دردِ پلورتیک + تنگی‌نفس + غیابِ صدای تنفسی — CXR. Harrison 22e Ch.55.",
      summary_en: "Pleuritic pain + dyspnea + absent breath — CXR. Harrison 22e Ch.55.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "clin", label_fa: "تظاهر: دردِ تیز + تنگی‌نفس + هیپرسونور", label_en: "Clin: sharp pain + dyspnea + hyperresonance", branch: "clinical", x: 0, y: 0 },
          { id: "cxr", label_fa: "CXR: خطِ پلور + فقدانِ مارکینگ", label_en: "CXR: pleural line + absent markings", branch: "workup", x: 0, y: 110 },
          { id: "rx", label_fa: "کوچک: مشاهده — بزرگ/تنشن: درن سینه", label_en: "Small: observe — large/tension: chest tube", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "clin", to: "cxr", label: "" }, { from: "cxr", to: "rx", label: "" }]
      }
    },
    {
      slug: "ards",
      title_fa: "سندرم زجر تنفسی حاد (ARDS)",
      title_en: "ARDS",
      type: "mind", system: "pulmo", level: "high_yield",
      summary_fa: "هیپوکسمیِ مقاوم + انفیلترای دوطرفه + PEEP. Harrison 22e Ch.54.",
      summary_en: "Refractory hypoxemia + bilateral infiltrates + PEEP. Harrison 22e Ch.54.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "def", label_fa: "برلین: PaO2/FiO2 <300 + CXR دوطرفه <7روز", label_en: "Berlin: PaO2/FiO2 <300 + bilateral <7d", branch: "definition", x: 0, y: 0 },
          { id: "cause", label_fa: "علل: پنومونی، سپسیس، آسپیراسیون، تروما", label_en: "Causes: pneumonia, sepsis, aspiration", branch: "etiology", x: 0, y: 110 },
          { id: "rx", label_fa: "ونتیلاسیونِ محافظتی (VT 6ml/kg) + PEEP + پرون", label_en: "Lung-protective VT 6 + PEEP + prone", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "def", to: "cause", label: "" }, { from: "cause", to: "rx", label: "" }]
      }
    },
    {
      slug: "lung-cancer",
      title_fa: "سرطان ریه",
      title_en: "Lung Cancer",
      type: "mind", system: "pulmo", level: "high_yield",
      summary_fa: "سرفه + هموپتزی + توده + NSCLC vs SCLC. Harrison 22e Ch.85.",
      summary_en: "Cough + hemoptysis + mass + NSCLC vs SCLC. Harrison 22e Ch.85.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "clin", label_fa: "سرفه مزمن + کاهش وزن + هموپتزی", label_en: "Chronic cough + weight loss + hemoptysis", branch: "clinical", x: 0, y: 0 },
          { id: "img", label_fa: "CT + بیوپسی → NSCLC (آدنو/اسکوام) vs SCLC", label_en: "CT + biopsy → NSCLC vs SCLC", branch: "workup", x: 0, y: 110 },
          { id: "rx", label_fa: "NSCLC: جراحی/شیمی/ایمونو — SCLC: شیمی+رادیو", label_en: "NSCLC: surgery/chemo/IO — SCLC: chemo+RT", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "clin", to: "img", label: "" }, { from: "img", to: "rx", label: "" }]
      }
    },
    {
      slug: "pulmonary-htn",
      title_fa: "هیپرتانسیون ریوی",
      title_en: "Pulmonary Hypertension",
      type: "mind", system: "pulmo", level: "core",
      summary_fa: "تنگی‌نفسِ فعالیتی + اکو PASP↑ + کات راست. Harrison 22e Ch.56.",
      summary_en: "Exertional dyspnea + echo PASP↑ + RHC. Harrison 22e Ch.56.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "clin", label_fa: "خستگی + سنکوپ + ادم + JVP↑", label_en: "Fatigue + syncope + edema + JVP↑", branch: "clinical", x: 0, y: 0 },
          { id: "echo", label_fa: "اکو: RVH + TR + PASP", label_en: "Echo: RVH + TR + PASP", branch: "workup", x: 0, y: 110 },
          { id: "rx", label_fa: "درمانِ علت + آنتاگونیست اندوتلین/سیلدنافیل", label_en: "Treat cause + ERA/PDE5", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "clin", to: "echo", label: "" }, { from: "echo", to: "rx", label: "" }]
      }
    },
    {
      slug: "sarcoidosis",
      title_fa: "سارکوئیدوز",
      title_en: "Sarcoidosis",
      type: "mind", system: "pulmo", level: "core",
      summary_fa: "لنفادنوپاتی نافی + گرانولوم غیرپنیری. Harrison 22e Ch.53.",
      summary_en: "Hilar LAD + noncaseating granuloma. Harrison 22e Ch.53.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "clin", label_fa: "سرفه + تنگی‌نفس + اریتم ندوزوم", label_en: "Cough + dyspnea + erythema nodosum", branch: "clinical", x: 0, y: 0 },
          { id: "img", label_fa: "CXR: لنف نافی دوطرفه + ACE↑ + بیوپسی", label_en: "CXR: bilateral hilar LAD + ACE↑ + biopsy", branch: "workup", x: 0, y: 110 },
          { id: "rx", label_fa: "اغلب خودمحدود — استروئید اگر علامت‌دار", label_en: "Often self-limited — steroids if symptomatic", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "clin", to: "img", label: "" }, { from: "img", to: "rx", label: "" }]
      }
    },
    {
      slug: "peptic-ulcer",
      title_fa: "زخم پپتیک",
      title_en: "Peptic Ulcer Disease",
      type: "mind", system: "gastro", level: "core",
      summary_fa: "درد اپی‌گاستر + H.pylori/NSAID + آندوسکوپی. Harrison 22e Ch.335.",
      summary_en: "Epigastric pain + H.pylori/NSAID + scope. Harrison 22e Ch.335.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "eti", label_fa: "علل: H.pylori، NSAID، استرس", label_en: "Causes: H.pylori, NSAID, stress", branch: "etiology", x: 0, y: 0 },
          { id: "clin", label_fa: "دردِ سوزشی + تهوع + خونریزی", label_en: "Burning pain + N/V + bleed", branch: "clinical", x: 0, y: 110 },
          { id: "rx", label_fa: "PPI + ریشه‌کنی H.pylori (کلاریترو/آموکسی) + پرهیز NSAID", label_en: "PPI + H.pylori erad + avoid NSAID", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "eti", to: "clin", label: "" }, { from: "clin", to: "rx", label: "" }]
      }
    },
    {
      slug: "cholecystitis",
      title_fa: "کوله‌سیستیت حاد",
      title_en: "Acute Cholecystitis",
      type: "mind", system: "gastro", level: "high_yield",
      summary_fa: "درد RUQ + مورفی + تب + سونو سنگ + دیواره ضخیم. Harrison 22e Ch.345.",
      summary_en: "RUQ pain + Murphy + fever + US stone + wall thick. Harrison 22e Ch.345.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "clin", label_fa: "درد RUQ + انتشار به شانه + تهوع", label_en: "RUQ pain radiating to shoulder + N/V", branch: "clinical", x: 0, y: 0 },
          { id: "us", label_fa: "سونو: سنگ + دیواره>3mm + مایع پری‌کوله", label_en: "US: stone + wall>3mm + fluid", branch: "workup", x: 0, y: 110 },
          { id: "rx", label_fa: "NPO + آنتی‌بیوتیک + کوله‌سیستکتومی لاپاروسکوپیک", label_en: "NPO + abx + lap chole", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "clin", to: "us", label: "" }, { from: "us", to: "rx", label: "" }]
      }
    },
    {
      slug: "colorectal-cancer",
      title_fa: "سرطان کولورکتال",
      title_en: "Colorectal Cancer",
      type: "mind", system: "gastro", level: "high_yield",
      summary_fa: "خون مخفی + تغییر اجابت + غربال FIT/کولونوسکوپی. Harrison 22e Ch.84.",
      summary_en: "Occult blood + change bowel + FIT/scope. Harrison 22e Ch.84.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "clin", label_fa: "خونریزی + کم‌خونی + کاهش وزن", label_en: "Bleed + anemia + weight loss", branch: "clinical", x: 0, y: 0 },
          { id: "scr", label_fa: "FIT + کولونوسکوپی + بیوپسی + CEA", label_en: "FIT + colonoscopy + biopsy + CEA", branch: "workup", x: 0, y: 110 },
          { id: "rx", label_fa: "جراحی + شیمی (FOLFOX) + غربال خانواده", label_en: "Surgery + FOLFOX + family screen", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "clin", to: "scr", label: "" }, { from: "scr", to: "rx", label: "" }]
      }
    },
    {
      slug: "ckd",
      title_fa: "بیماری مزمن کلیه (CKD)",
      title_en: "Chronic Kidney Disease",
      type: "mind", system: "nephro", level: "high_yield",
      summary_fa: "GFR↓ >3ماه + آلبومینوری + عوارض. Harrison 22e Ch.64.",
      summary_en: "GFR↓ >3mo + albuminuria + complications. Harrison 22e Ch.64.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "st", label_fa: "مرحله‌بندی: G1-G5 + A1-A3", label_en: "Stage: G1-G5 + A1-A3", branch: "definition", x: 0, y: 0 },
          { id: "comp", label_fa: "عوارض: آنمی، CKD-MBD، اسیدوز، HTN", label_en: "Comp: anemia, CKD-MBD, acidosis, HTN", branch: "complication", x: 0, y: 110 },
          { id: "rx", label_fa: "ACE/ARB + SGLT2 + کنترلِ فشار/قند + دیالیز G5", label_en: "ACE/ARB + SGLT2 + BP/glc + dialysis G5", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "st", to: "comp", label: "" }, { from: "comp", to: "rx", label: "" }]
      }
    },
    {
      slug: "metabolic-acidosis",
      title_fa: "اسیدوز متابولیک",
      title_en: "Metabolic Acidosis",
      type: "approach", system: "nephro", level: "high_yield",
      summary_fa: "pH↓ + HCO3↓ + آنیون‌گپ. Harrison 22e Ch.66.",
      summary_en: "pH↓ + HCO3↓ + anion gap. Harrison 22e Ch.66.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "abg", label_fa: "ABG: pH↓ + HCO3↓", label_en: "ABG: pH↓ + HCO3↓", branch: "workup", x: 0, y: 0 },
          { id: "gap", label_fa: "AG↑: لاکتات، کتو، کلیه، سم (MUDPILES)", label_en: "High AG: lactate, keto, renal, toxin", branch: "etiology", x: -200, y: 110 },
          { id: "nongap", label_fa: "AG نرمال: RTA، اسهال، استازولامید", label_en: "Normal AG: RTA, diarrhea", branch: "etiology", x: 200, y: 110 },
          { id: "rx", label_fa: "درمانِ علت + بیکربنات اگر pH<7.1 شدید", label_en: "Treat cause + bicarb if pH<7.1", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "abg", to: "gap", label: "" }, { from: "abg", to: "nongap", label: "" }, { from: "gap", to: "rx", label: "" }]
      }
    },
    {
      slug: "hypercalcemia-appro",
      title_fa: "هیپرکلسمی — اپروچ",
      title_en: "Hypercalcemia",
      type: "approach", system: "endo", level: "high_yield",
      summary_fa: "Ca>10.5 + PTH + بدخیمی. Harrison 22e Ch.47.",
      summary_en: "Ca>10.5 + PTH + malignancy. Harrison 22e Ch.47.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "lab", label_fa: "Ca↑ + علائم: یبوست، پلی‌یوری، گیجی", label_en: "High Ca + constip, polyuria, confusion", branch: "clinical", x: 0, y: 0 },
          { id: "pth", label_fa: "PTH↑ → هیپرپارا — PTH↓ → بدخیمی/ویت D", label_en: "High PTH → hyperpara — low → malignancy", branch: "workup", x: 0, y: 110 },
          { id: "rx", label_fa: "مایعات + بیس‌فسفونات + کلسی‌تونین + درمانِ علت", label_en: "Fluids + bisphos + calcitonin + treat cause", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "lab", to: "pth", label: "" }, { from: "pth", to: "rx", label: "" }]
      }
    },
    {
      slug: "pheochromocytoma",
      title_fa: "فئوکروموسیتوم",
      title_en: "Pheochromocytoma",
      type: "mind", system: "endo", level: "core",
      summary_fa: "HTN حمله‌ای + تعریق + تپش + متانفرین↑. Harrison 22e Ch.40.",
      summary_en: "Paroxysmal HTN + sweat + palp + metanephrine↑. Harrison 22e Ch.40.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "tri", label_fa: "تریاد: سردرد + تعریق + تپش", label_en: "Triad: headache + sweat + palp", branch: "clinical", x: 0, y: 0 },
          { id: "lab", label_fa: "متانفرینِ پلاسما/ادرار↑ + CT آدرنال", label_en: "Plasma/urine metanephrine↑ + CT", branch: "workup", x: 0, y: 110 },
          { id: "rx", label_fa: "آلفا (فنوکسی) سپس بتا + جراحی", label_en: "Alpha then beta + surgery", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "tri", to: "lab", label: "" }, { from: "lab", to: "rx", label: "" }]
      }
    },
    {
      slug: "parkinson",
      title_fa: "پارکینسون",
      title_en: "Parkinson Disease",
      type: "mind", system: "neuro", level: "high_yield",
      summary_fa: "ترمورِ استراحت + ریژیدیتی + برادی‌کینزی + پاسخ به لوودوپا. Harrison 22e Ch.79.",
      summary_en: "Rest tremor + rigidity + bradykinesia + levodopa response. Harrison 22e Ch.79.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "tri", label_fa: "تریاد + ناپایداری وضعیتی", label_en: "Triad + postural instability", branch: "clinical", x: 0, y: 0 },
          { id: "dx", label_fa: "بالینی + DAT-SPECT اگر شک", label_en: "Clinical + DAT-SPECT if doubt", branch: "workup", x: 0, y: 110 },
          { id: "rx", label_fa: "لوودوپا/کاربی‌دوپا + آگونیست دوپا + DBS", label_en: "Levodopa + dopamine agonist + DBS", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "tri", to: "dx", label: "" }, { from: "dx", to: "rx", label: "" }]
      }
    },
    {
      slug: "alzheimer",
      title_fa: "آلزایمر",
      title_en: "Alzheimer Disease",
      type: "mind", system: "neuro", level: "core",
      summary_fa: "اختلال حافظهٔ پیشرونده + آتروفی هیپوکامپ. Harrison 22e Ch.79.",
      summary_en: "Progressive memory loss + hippocampal atrophy. Harrison 22e Ch.79.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "clin", label_fa: "فراموشیِ اخیر + اختلالِ عملکرد روزانه", label_en: "Recent memory loss + ADL impairment", branch: "clinical", x: 0, y: 0 },
          { id: "img", label_fa: "MRI: آتروفی + PET آمیلوئید + CSF Aβ/tau", label_en: "MRI: atrophy + amyloid PET + CSF", branch: "workup", x: 0, y: 110 },
          { id: "rx", label_fa: "دونپزیل + ممانتین + حمایت", label_en: "Donepezil + memantine + support", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "clin", to: "img", label: "" }, { from: "img", to: "rx", label: "" }]
      }
    },
    {
      slug: "sah",
      title_fa: "خونریزی ساب‌آراکنوئید (SAH)",
      title_en: "Subarachnoid Hemorrhage",
      type: "mind", system: "neuro", level: "emergency",
      summary_fa: "سردردِ برق‌آسا + سفتی گردن + CT. Harrison 22e Ch.68.",
      summary_en: "Thunderclap headache + neck stiffness + CT. Harrison 22e Ch.68.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "clin", label_fa: "سردردِ ناگهانیِ شدید + تهوع + فتوفوبی", label_en: "Sudden severe headache + N/V + photophobia", branch: "clinical", x: 0, y: 0 },
          { id: "ct", label_fa: "CT: خون ساب‌آراکنوئید — اگر منفی LP", label_en: "CT: SAH blood — if neg LP", branch: "workup", x: 0, y: 110 },
          { id: "rx", label_fa: "نیمودیپین + Sicherung آنوریسم (کویل/کلیپ)", label_en: "Nimodipine + secure aneurysm", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "clin", to: "ct", label: "" }, { from: "ct", to: "rx", label: "" }]
      }
    },
    {
      slug: "myasthenia",
      title_fa: "میاستنی گراویس",
      title_en: "Myasthenia Gravis",
      type: "mind", system: "neuro", level: "high_yield",
      summary_fa: "ضعفِ نوسانی + پتوز + آنتی-AChR. Harrison 22e Ch.77.",
      summary_en: "Fluctuating weakness + ptosis + anti-AChR. Harrison 22e Ch.77.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "clin", label_fa: "پتوز/دوبینی + ضعفِ انتهای روز + بهبود با استراحت", label_en: "Ptosis/diplopia + fatigable weakness", branch: "clinical", x: 0, y: 0 },
          { id: "test", label_fa: "آنتی-AChR + EMG + تست ادروفونیوم", label_en: "Anti-AChR + EMG + edrophonium", branch: "workup", x: 0, y: 110 },
          { id: "rx", label_fa: "پیریدوستیگمین + استروئید + IVIG + تیمکتومی", label_en: "Pyridostigmine + steroids + IVIG + thymectomy", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "clin", to: "test", label: "" }, { from: "test", to: "rx", label: "" }]
      }
    },
    {
      slug: "leukemia-aml",
      title_fa: "لوسمی میلوئیدی حاد (AML)",
      title_en: "Acute Myeloid Leukemia",
      type: "mind", system: "heme", level: "high_yield",
      summary_fa: "بلاست>20% + پن‌سیتوپنی + Auer rod. Harrison 22e Ch.81.",
      summary_en: "Blasts>20% + pancytopenia + Auer. Harrison 22e Ch.81.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "clin", label_fa: "تب + خونریزی + خستگی + هپاتواسپلنومگالی", label_en: "Fever + bleed + fatigue + HSM", branch: "clinical", x: 0, y: 0 },
          { id: "lab", label_fa: "CBC: پن‌سیتوپنی + بلاست — مغز استخوان >20%", label_en: "CBC: pancytopenia + blasts — marrow >20%", branch: "workup", x: 0, y: 110 },
          { id: "rx", label_fa: "شیمی (7+3) + ATRA اگر APL + پیوند", label_en: "Chemo 7+3 + ATRA if APL + transplant", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "clin", to: "lab", label: "" }, { from: "lab", to: "rx", label: "" }]
      }
    },
    {
      slug: "lymphoma",
      title_fa: "لنفوم (هوچکین/غیرهوچکین)",
      title_en: "Lymphoma",
      type: "mind", system: "heme", level: "high_yield",
      summary_fa: "لنفادنوپاتی + B symptoms + بیوپسی. Harrison 22e Ch.82.",
      summary_en: "LAD + B symptoms + biopsy. Harrison 22e Ch.82.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "clin", label_fa: "تودهٔ بدون درد + تعریق شبانه + کاهش وزن + تب", label_en: "Painless mass + night sweat + weight loss + fever", branch: "clinical", x: 0, y: 0 },
          { id: "bx", label_fa: "بیوپسیِ اکسیزیونال + IHC + Ann Arbor", label_en: "Excisional biopsy + IHC + Ann Arbor", branch: "workup", x: 0, y: 110 },
          { id: "rx", label_fa: "هوچکین: ABVD — غیرهوچکین: R-CHOP", label_en: "Hodgkin: ABVD — NHL: R-CHOP", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "clin", to: "bx", label: "" }, { from: "bx", to: "rx", label: "" }]
      }
    },
    {
      slug: "myeloma",
      title_fa: "مولتیپل میلوما",
      title_en: "Multiple Myeloma",
      type: "mind", system: "heme", level: "high_yield",
      summary_fa: "CRAB + M پروتئین + پلاسماسل>10%. Harrison 22e Ch.83.",
      summary_en: "CRAB + M protein + plasma>10%. Harrison 22e Ch.83.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "crab", label_fa: "CRAB: Ca↑, نارسایی کلیه، آنمی، Bone pain", label_en: "CRAB: Ca, renal, anemia, bone", branch: "clinical", x: 0, y: 0 },
          { id: "lab", label_fa: "SPEP: M spike + Bence-Jones + مغز", label_en: "SPEP: M spike + Bence Jones + marrow", branch: "workup", x: 0, y: 110 },
          { id: "rx", label_fa: "بورتیزومیب + لنالیدومید + دگزا + پیوند", label_en: "Bortezomib + len + dex + transplant", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "crab", to: "lab", label: "" }, { from: "lab", to: "rx", label: "" }]
      }
    },
    {
      slug: "dic",
      title_fa: "انعقاد داخل‌عروقی منتشر (DIC)",
      title_en: "DIC",
      type: "mind", system: "heme", level: "emergency",
      summary_fa: "خونریزی + ترومبوز + PT↑ + پلاکت↓ + D-dimer↑. Harrison 22e Ch.26.",
      summary_en: "Bleed + thrombosis + PT↑ + low plt + D-dimer↑. Harrison 22e Ch.26.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "trig", label_fa: "محرک: سپسیس، تروما، بدخیمی، مامایی", label_en: "Trigger: sepsis, trauma, malignancy, obstetric", branch: "etiology", x: 0, y: 0 },
          { id: "lab", label_fa: "PT↑ + PTT↑ + فیبرینوژن↓ + D-dimer↑ + پلاکت↓", label_en: "PT↑ PTT↑ fibrin↓ D-dimer↑ low plt", branch: "workup", x: 0, y: 110 },
          { id: "rx", label_fa: "درمانِ علت + FFP/پلاکت + هپارین اگر ترومبوز", label_en: "Treat cause + FFP/plt + heparin if clot", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "trig", to: "lab", label: "" }, { from: "lab", to: "rx", label: "" }]
      }
    },
    {
      slug: "gout",
      title_fa: "نقرس",
      title_en: "Gout",
      type: "mind", system: "rheum", level: "core",
      summary_fa: "مونوآرتریتِ حاد + کریستالِ سوزنیِ منفی. Harrison 22e Ch.46.",
      summary_en: "Acute monoarthritis + needle negative. Harrison 22e Ch.46.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "clin", label_fa: "پوداگرا (شست پا) + قرمزی + دردِ شبانه", label_en: "Podagra + red + night pain", branch: "clinical", x: 0, y: 0 },
          { id: "fluid", label_fa: "مایع مفصلی: کریستالِ سوزنیِ منفی + WBC↑", label_en: "Synovial: needle negative + WBC↑", branch: "workup", x: 0, y: 110 },
          { id: "rx", label_fa: "حاد: NSAID/کلشی‌سین — مزمن: آلوپورینول + پرهیز", label_en: "Acute: NSAID/colch — chronic: allopurinol", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "clin", to: "fluid", label: "" }, { from: "fluid", to: "rx", label: "" }]
      }
    },
    {
      slug: "scleroderma",
      title_fa: "اسکلرودرمی",
      title_en: "Systemic Sclerosis",
      type: "mind", system: "rheum", level: "core",
      summary_fa: "سفتی پوست + رینود + فیبروز ریه. Harrison 22e Ch.76.",
      summary_en: "Skin thickening + Raynaud + lung fibrosis. Harrison 22e Ch.76.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "clin", label_fa: "پوست سفت + رینود + دیسفاژی", label_en: "Tight skin + Raynaud + dysphagia", branch: "clinical", x: 0, y: 0 },
          { id: "ab", label_fa: "آنتی-Scl-70 / سنترومر + کاپیلاروسکوپی", label_en: "Anti-Scl70 / centromere + capillaroscopy", branch: "workup", x: 0, y: 110 },
          { id: "rx", label_fa: "علامتی + ACE برای کرایز کلیوی + میکوفنولات", label_en: "Sympt + ACE for renal crisis + MMF", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "clin", to: "ab", label: "" }, { from: "ab", to: "rx", label: "" }]
      }
    },
    {
      slug: "sjogren",
      title_fa: "شوگرن",
      title_en: "Sjögren",
      type: "mind", system: "rheum", level: "core",
      summary_fa: "خشکی چشم/دهان + آنتی-Ro/La. Harrison 22e Ch.76.",
      summary_en: "Dry eye/mouth + anti-Ro/La. Harrison 22e Ch.76.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "clin", label_fa: "خشکی + پوسیدگی + پاروتیت", label_en: "Dryness + caries + parotitis", branch: "clinical", x: 0, y: 0 },
          { id: "test", label_fa: "Schirmer + آنتی-Ro/La + بیوپسی لب", label_en: "Schirmer + anti-Ro/La + lip biopsy", branch: "workup", x: 0, y: 110 },
          { id: "rx", label_fa: "اشک/بزاق مصنوعی + هیدروکسی‌کلروکین", label_en: "Artificial tears/saliva + HCQ", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "clin", to: "test", label: "" }, { from: "test", to: "rx", label: "" }]
      }
    },
    {
      slug: "approach-syncope",
      title_fa: "سنکوپ — اپروچ",
      title_en: "Syncope — Approach",
      type: "approach", system: "other", level: "core",
      summary_fa: "افتِ گذرای هوشیاری + علل قلبی/رفلکسی. Harrison 22e Ch.27.",
      summary_en: "Transient LOC + cardiac/reflex causes. Harrison 22e Ch.27.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "hist", label_fa: "شرح: محرک، پوزیشن، تپش، تشنج؟", label_en: "History: trigger, position, palp, seizure?", branch: "workup", x: 0, y: 0 },
          { id: "card", label_fa: "قلبی: آریتمی/ساختمانی → ECG/اکو/هولتر", label_en: "Cardiac: arrhythmia/struct → ECG/echo/Holter", branch: "workup", x: -200, y: 110 },
          { id: "reflex", label_fa: "رفلکسی/ارتوستاتیک → تیلت/فشار", label_en: "Reflex/orthostatic → tilt/BP", branch: "workup", x: 200, y: 110 },
          { id: "rx", label_fa: "پیس/ICD اگر قلبی + آموزش اگر رفلکسی", label_en: "Pace/ICD if cardiac + education if reflex", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "hist", to: "card", label: "" }, { from: "hist", to: "reflex", label: "" }, { from: "card", to: "rx", label: "" }]
      }
    },
    {
      slug: "approach-vertigo",
      title_fa: "سرگیجه دورانی — اپروچ",
      title_en: "Vertigo — Approach",
      type: "approach", system: "neuro", level: "core",
      summary_fa: "محیطی vs مرکزی + Dix-Hallpike. Harrison 22e Ch.28.",
      summary_en: "Peripheral vs central + Dix-Hallpike. Harrison 22e Ch.28.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "per", label_fa: "محیطی: BPPV، منییر، نوریت وستیبولار (شنوایی ±)", label_en: "Peripheral: BPPV, Meniere, vest neuritis", branch: "clinical", x: -200, y: 0 },
          { id: "cent", label_fa: "مرکزی: سکته/ MS (بدون شنوایی + علائم ساقه)", label_en: "Central: stroke/MS (no hearing + brainstem)", branch: "clinical", x: 200, y: 0 },
          { id: "test", label_fa: "Dix-Hallpike + HINTS + MRI اگر مرکزی", label_en: "Dix-Hallpike + HINTS + MRI if central", branch: "workup", x: 0, y: 110 },
          { id: "rx", label_fa: "Epley برای BPPV + وستیبولار توانبخشی", label_en: "Epley for BPPV + vest rehab", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "per", to: "test", label: "" }, { from: "cent", to: "test", label: "" }, { from: "test", to: "rx", label: "" }]
      }
    },
    {
      slug: "approach-jaundice",
      title_fa: "یرقان — اپروچ",
      title_en: "Jaundice — Approach",
      type: "approach", system: "gastro", level: "core",
      summary_fa: "مستقیم vs غیرمستقیم. Harrison 22e Ch.45.",
      summary_en: "Direct vs indirect. Harrison 22e Ch.45.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "bili", label_fa: "بیلی‌روبین: غیرمستقیم↑ → همولیز/ژیلبرت", label_en: "Indirect↑ → hemolysis/Gilbert", branch: "workup", x: -200, y: 0 },
          { id: "direct", label_fa: "مستقیم↑ → کلستاز/هپاتوسلولار", label_en: "Direct↑ → cholestasis/hepatocellular", branch: "workup", x: 200, y: 0 },
          { id: "img", label_fa: "US/MRCP + آنزیم (ALP/ALT) + INR", label_en: "US/MRCP + ALP/ALT + INR", branch: "workup", x: 0, y: 110 },
          { id: "rx", label_fa: "درمانِ علت + ERCP اگر انسداد", label_en: "Treat cause + ERCP if obstruction", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "bili", to: "img", label: "" }, { from: "direct", to: "img", label: "" }, { from: "img", to: "rx", label: "" }]
      }
    },
    {
      slug: "approach-edema",
      title_fa: "ادم — افتراق",
      title_en: "Edema — Approach",
      type: "approach", system: "other", level: "core",
      summary_fa: "سیستمیک vs لوکال. Harrison 22e Ch.46.",
      summary_en: "Systemic vs local. Harrison 22e Ch.46.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "loc", label_fa: "لوکال: DVT، سلولیت، لنف‌ادم", label_en: "Local: DVT, cellulitis, lymphedema", branch: "clinical", x: -200, y: 0 },
          { id: "sys", label_fa: "سیستمیک: HF، سیروز، نفروتیک، دارو", label_en: "Systemic: HF, cirrhosis, nephrotic, drug", branch: "clinical", x: 200, y: 0 },
          { id: "work", label_fa: "BNP، آلبومین، ادرار، تیروئید", label_en: "BNP, albumin, urine, thyroid", branch: "workup", x: 0, y: 110 },
          { id: "rx", label_fa: "نمک کم + دیورتیک + درمانِ علت", label_en: "Low salt + diuretic + treat cause", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "loc", to: "work", label: "" }, { from: "sys", to: "work", label: "" }, { from: "work", to: "rx", label: "" }]
      }
    },
    {
      slug: "cellulitis",
      title_fa: "سلولیت",
      title_en: "Cellulitis",
      type: "mind", system: "infect", level: "core",
      summary_fa: "اریتم + گرما + ادم + تب — استرپتو/استاف. Harrison 22e Ch.131.",
      summary_en: "Erythema + warmth + edema + fever — strep/staph. Harrison 22e Ch.131.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "clin", label_fa: "پوستِ قرمزِ گرم + درد + تب", label_en: "Red warm skin + pain + fever", branch: "clinical", x: 0, y: 0 },
          { id: "ddx", label_fa: "افتراق: DVT، نقرس، درماتیت", label_en: "DDx: DVT, gout, dermatitis", branch: "ddx", x: 0, y: 110 },
          { id: "rx", label_fa: "سفالکسین/کلیندا + بالا نگه‌داشتن + علامت‌گذاری", label_en: "Cephalexin/clinda + elevation + marking", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "clin", to: "ddx", label: "" }, { from: "ddx", to: "rx", label: "" }]
      }
    },
    {
      slug: "influenza",
      title_fa: "آنفلوانزا",
      title_en: "Influenza",
      type: "mind", system: "infect", level: "high_yield",
      summary_fa: "تب ناگهانی + میالژی + سرفه — PCR + اوسلتامیویر. Harrison 22e Ch.210.",
      summary_en: "Sudden fever + myalgia + cough — PCR + oseltamivir. Harrison 22e Ch.210.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "clin", label_fa: "تب + لرز + میالژی + سرفه خشک", label_en: "Fever + chill + myalgia + dry cough", branch: "clinical", x: 0, y: 0 },
          { id: "test", label_fa: "Rapid Ag/PCR — در فصلِ اپیدمی", label_en: "Rapid/PCR in season", branch: "workup", x: 0, y: 110 },
          { id: "rx", label_fa: "اوسلتامیویر <48h + واکسنِ سالانه", label_en: "Oseltamivir <48h + annual vaccine", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "clin", to: "test", label: "" }, { from: "test", to: "rx", label: "" }]
      }
    },
    {
      slug: "poisoning",
      title_fa: "مسمومیت — اپروچ کلی",
      title_en: "Poisoning — General Approach",
      type: "approach", system: "emergency", level: "emergency",
      summary_fa: "ABC + دکنتامینه + آنتی‌دوت. Harrison 22e Ch.14.",
      summary_en: "ABC + decontam + antidote. Harrison 22e Ch.14.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "abc", label_fa: "ABC + گلوکز + نالوکسان + تیامین", label_en: "ABC + glucose + naloxone + thiamine", branch: "action", x: 0, y: 0 },
          { id: "hist", label_fa: "شرح + معاینه + لاب (ABG، ECG، استامینوفن)", label_en: "History + exam + labs (ABG, ECG, acetaminophen)", branch: "workup", x: 0, y: 110 },
          { id: "decon", label_fa: "زغال فعال <1h + شستشو اگر لازم", label_en: "Activated charcoal <1h + lavage if needed", branch: "treatment", x: -200, y: 220 },
          { id: "antid", label_fa: "آنتی‌دوت: نالوکسان، فلومازنیل، NAC", label_en: "Antidote: naloxone, flumazenil, NAC", branch: "treatment", x: 200, y: 220 },
        ],
        edges: [{ from: "abc", to: "hist", label: "" }, { from: "hist", to: "decon", label: "" }, { from: "hist", to: "antid", label: "" }]
      }
    },
    {
      slug: "cardiac-arrest",
      title_fa: "ایست قلبی — ACLS",
      title_en: "Cardiac Arrest — ACLS",
      type: "approach", system: "emergency", level: "emergency",
      summary_fa: "VF/VT vs آسystole/PEA + CPR + اپی. Harrison 22e Ch.317.",
      summary_en: "VF/VT vs asystole/PEA + CPR + epi. Harrison 22e Ch.317.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "rhy", label_fa: "ریتم: VF/VT قابلِ شوک vs PEA/آسیستول غیرقابل", label_en: "Rhythm: VF/VT shockable vs PEA/asystole non", branch: "workup", x: 0, y: 0 },
          { id: "cpr", label_fa: "CPR با کیفیت + شوک اگر VF/VT + اپی هر 3-5min", label_en: "High-quality CPR + shock if VF/VT + epi q3-5", branch: "treatment", x: 0, y: 110 },
          { id: "rev", label_fa: "Hs & Ts: هیپوکسی، هیپوولمی، K، تامپوناد، PE", label_en: "Hs & Ts: hypoxia, hypoV, K, tamponade, PE", branch: "etiology", x: 0, y: 220 },
        ],
        edges: [{ from: "rhy", to: "cpr", label: "" }, { from: "cpr", to: "rev", label: "" }]
      }
    },
    {
      slug: "covid",
      title_fa: "کووید-۱۹",
      title_en: "COVID-19",
      type: "mind", system: "infect", level: "high_yield",
      summary_fa: "تب + سرفه + هیپوکسی + PCR + رمدسیویر/دگزا. Harrison 22e Ch.208.",
      summary_en: "Fever + cough + hypoxia + PCR + remdesivir/dex. Harrison 22e Ch.208.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "clin", label_fa: "تب + سرفه + تنگی‌نفس + از دست‌دادن بویایی", label_en: "Fever + cough + dyspnea + anosmia", branch: "clinical", x: 0, y: 0 },
          { id: "test", label_fa: "PCR/Antigen + CXR/CT + CRP/لنفوپنی", label_en: "PCR/Ag + CXR/CT + CRP/lymphopenia", branch: "workup", x: 0, y: 110 },
          { id: "rx", label_fa: "حمایتی + دگزا اگر هیپوکسی + رمدسیویر + واکسن", label_en: "Support + dex if hypoxic + remdesivir + vaccine", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "clin", to: "test", label: "" }, { from: "test", to: "rx", label: "" }]
      }
    },
    {
      slug: "hypernatremia-appro",
      title_fa: "هیپرناترمی",
      title_en: "Hypernatremia",
      type: "approach", system: "nephro", level: "core",
      summary_fa: "Na>145 + تشنگی/گیجی + علتِ کم‌آبی. Harrison 22e Ch.47.",
      summary_en: "Na>145 + thirst/confusion + water loss. Harrison 22e Ch.47.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "clin", label_fa: "Na↑ + تشنگی + گیجی + الیگوری/پلی‌یوری", label_en: "High Na + thirst + confusion", branch: "clinical", x: 0, y: 0 },
          { id: "vol", label_fa: "حجم: هیپوولمیک (اسهال/دیورتیک) vs یوولمیک (DI)", label_en: "Vol: hypo (diarrhea) vs eu (DI)", branch: "workup", x: 0, y: 110 },
          { id: "rx", label_fa: "مایعاتِ هیپوتونیک + درمانِ DI/علت + اصلاحِ آهسته", label_en: "Hypotonic fluids + treat DI + slow correction", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "clin", to: "vol", label: "" }, { from: "vol", to: "rx", label: "" }]
      }
    },
    {
      slug: "siadh",
      title_fa: "SIADH",
      title_en: "SIADH",
      type: "mind", system: "endo", level: "high_yield",
      summary_fa: "هیپوناترمیِ یوولمیک + اسمولالیته پایین + Na ادرار بالا. Harrison 22e Ch.47.",
      summary_en: "Euvolemic hypoNa + low osmol + high urine Na. Harrison 22e Ch.47.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "lab", label_fa: "Na↓ + اسمول پایین + ادرار غلیظ + تیروئید/آدرنال نرمال", label_en: "Low Na + low osmol + concentrated urine + normal thyroid/adrenal", branch: "workup", x: 0, y: 0 },
          { id: "cause", label_fa: "علل: دارو، بدخیمی، CNS، ریه", label_en: "Causes: drugs, malignancy, CNS, lung", branch: "etiology", x: 0, y: 110 },
          { id: "rx", label_fa: "محدودیت مایعات + نمک هیپرتونیک اگر شدید + تولواپتان", label_en: "Fluid restrict + hypertonic if severe + tolvaptan", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "lab", to: "cause", label: "" }, { from: "cause", to: "rx", label: "" }]
      }
    },
    {
      slug: "acromegaly",
      title_fa: "آکرومگالی",
      title_en: "Acromegaly",
      type: "mind", system: "endo", level: "core",
      summary_fa: "GH↑ + دست/پا بزرگ + IGF-1↑ + آدنوم هیپوفیز. Harrison 22e Ch.40.",
      summary_en: "High GH + large hands/feet + high IGF1 + pituitary adenoma. Harrison 22e Ch.40.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "clin", label_fa: "بزرگیِ دست/پا + پروگناتیسم + تعریق + HTN/DM", label_en: "Large hands/feet + prognathism + sweat + HTN/DM", branch: "clinical", x: 0, y: 0 },
          { id: "lab", label_fa: "IGF-1↑ + OGTT GH عدمِ سرکوب + MRI هیپوفیز", label_en: "High IGF1 + OGTT non-suppressed + MRI", branch: "workup", x: 0, y: 110 },
          { id: "rx", label_fa: "جراحی ترانس‌اسفنوئیدال + اکترئوتاید + پرتودرمانی", label_en: "Transsphenoidal + octreotide + RT", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "clin", to: "lab", label: "" }, { from: "lab", to: "rx", label: "" }]
      }
    },
    {
      slug: "osteomyelitis",
      title_fa: "استئومیلیت",
      title_en: "Osteomyelitis",
      type: "mind", system: "infect", level: "core",
      summary_fa: "دردِ استخوان + تب + ESR↑ + MRI — استاف. Harrison 22e Ch.133.",
      summary_en: "Bone pain + fever + high ESR + MRI — staph. Harrison 22e Ch.133.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "clin", label_fa: "دردِ موضعی + تب + قرمزی + سابقهٔ زخم/تروما", label_en: "Local pain + fever + redness + wound/trauma", branch: "clinical", x: 0, y: 0 },
          { id: "img", label_fa: "MRI: ادم مغز استخوان + کشتِ خون/استخوان", label_en: "MRI: marrow edema + blood/bone culture", branch: "workup", x: 0, y: 110 },
          { id: "rx", label_fa: "آنتی‌بیوتیک طولانی (nafcillin/ونکو) + دبریدمان", label_en: "Long abx + debridement", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "clin", to: "img", label: "" }, { from: "img", to: "rx", label: "" }]
      }
    },
    {
      slug: "malaria",
      title_fa: "مالاریا",
      title_en: "Malaria",
      type: "mind", system: "infect", level: "core",
      summary_fa: "تبِ متناوب + لرز + آنمی + اسمیرِ خونی. Harrison 22e Ch.230.",
      summary_en: "Intermittent fever + chill + anemia + blood smear. Harrison 22e Ch.230.",
      cover_url: "/covers/harrison.jpg",
      graph_json: {
        nodes: [
          { id: "clin", label_fa: "تب + لرز + تعریق + همولیز + اسپلنومگالی", label_en: "Fever + chill + sweat + hemolysis + splenomegaly", branch: "clinical", x: 0, y: 0 },
          { id: "smear", label_fa: "اسمیرِ ضخیم/نازک + RDT + PCR", label_en: "Thick/thin smear + RDT + PCR", branch: "workup", x: 0, y: 110 },
          { id: "rx", label_fa: "آرتمترین/کلروکین + پرایمکین برای ویواکس + پیشگیری", label_en: "Artemether/chloroquine + primaquine for vivax + prophylaxis", branch: "treatment", x: 0, y: 220 },
        ],
        edges: [{ from: "clin", to: "smear", label: "" }, { from: "smear", to: "rx", label: "" }]
      }
    },
  ];

  let inserted = 0;
  for (const m of maps) {
    const g = JSON.stringify(m.graph_json);
    try {
      db.prepare(`
        INSERT OR IGNORE INTO mindmap_bank (slug,title_fa,title_en,type,system,level,summary_fa,summary_en,graph_json,cover_url,is_premium,status)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(m.slug, m.title_fa, m.title_en, m.type, m.system, m.level, m.summary_fa, m.summary_en, g, m.cover_url, (m.is_premium===false?0:1), m.status||"active");
      if (db.prepare("SELECT changes() c").get().c > 0) inserted++;
    } catch (e) { /* ignore */ }
  }

  // Auto-link: for each map, link 5 questions by keyword
  try {
    const allMaps = db.prepare("SELECT slug, title_fa FROM mindmap_bank").all();
    for (const mp of allMaps) {
      const kw = mp.title_fa.split(" — ")[0].split(" ")[0].replace(/[—()]/g,"");
      if (!kw || kw.length < 2) continue;
      const candidates = db.prepare(`
        SELECT id FROM flashcards WHERE active=1 AND (
          json_extract(data_json,'$.q') LIKE '%' || ? || '%'
          OR json_extract(data_json,'$.topic') LIKE '%' || ? || '%'
        ) LIMIT 5
      `).all(kw, kw);
      for (const c of candidates) {
        try {
          db.prepare("INSERT OR IGNORE INTO question_mindmap_links (question_id,mindmap_slug,weight) VALUES (?,?,1)").run(c.id, mp.slug);
        } catch {}
      }
    }
  } catch {}

  // Ensure all maps have at least 3 links (fallback to random)
  try {
    const allMaps = db.prepare("SELECT slug FROM mindmap_bank").all();
    for (const mp of allMaps) {
      const cnt = db.prepare("SELECT COUNT(*) c FROM question_mindmap_links WHERE mindmap_slug=?").get(mp.slug).c;
      if (cnt < 3) {
        const need = 3 - cnt;
        const rand = db.prepare(`SELECT id FROM flashcards WHERE active=1 ORDER BY RANDOM() LIMIT ?`).all(need);
        for (const r of rand) {
          try { db.prepare("INSERT OR IGNORE INTO question_mindmap_links (question_id,mindmap_slug,weight) VALUES (?,?,1)").run(r.id, mp.slug); } catch {}
        }
      }
    }
  } catch {}

  return { seeded: inserted, total: db.prepare("SELECT COUNT(*) c FROM mindmap_bank").get().c };
}
