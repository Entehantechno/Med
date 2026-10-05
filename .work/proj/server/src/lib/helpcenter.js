/* helpcenter.js — admin-editable FAQ / knowledge-base articles, shown in-app
   (searchable, categorized) to deflect support tickets. Bilingual; each article
   has a category and can be published/unpublished and ordered by admins. */
import { db, persistNow } from "../db.js";

export const HELP_CATEGORIES = ["general", "account", "learning", "billing", "technical"];
const cat = (c) => (HELP_CATEGORIES.includes(c) ? c : "general");
const pick = (a, lang) => ({
  id: a.id, category: a.category,
  title: lang === "fa" ? (a.title_fa || a.title_en) : (a.title_en || a.title_fa),
  body: lang === "fa" ? (a.body_fa || a.body_en) : (a.body_en || a.body_fa),
  views: a.views,
});

// public: published articles, optionally filtered by category or a search query
export function publicArticles(lang = "fa", { q = "", category = "" } = {}) {
  const rows = db.prepare("SELECT * FROM help_articles WHERE published=1 ORDER BY ord, id").all();
  let list = rows.map((a) => pick(a, lang));
  if (category && HELP_CATEGORIES.includes(category)) list = list.filter((a) => a.category === category);
  const term = (q || "").trim().toLowerCase();
  if (term) list = list.filter((a) => `${a.title} ${a.body}`.toLowerCase().includes(term));
  return list;
}

export function viewArticle(id, lang = "fa") {
  const a = db.prepare("SELECT * FROM help_articles WHERE id=? AND published=1").get(id);
  if (!a) return null;
  db.prepare("UPDATE help_articles SET views=views+1 WHERE id=?").run(id);
  persistNow();
  return pick(a, lang);
}

// admin: full list (incl. drafts)
export function adminArticles() {
  return db.prepare("SELECT * FROM help_articles ORDER BY ord, id").all();
}
export function createArticle(b) {
  const info = db.prepare(`INSERT INTO help_articles (category,title_fa,title_en,body_fa,body_en,ord,published)
      VALUES (?,?,?,?,?,?,?)`).run(cat(b.category), b.title_fa || "", b.title_en || "", b.body_fa || "", b.body_en || "",
    Number(b.ord) || 0, b.published === 0 ? 0 : 1);
  persistNow();
  return info.lastInsertRowid;
}
export function updateArticle(id, b) {
  db.prepare(`UPDATE help_articles SET category=?, title_fa=?, title_en=?, body_fa=?, body_en=?, ord=?, published=?, updated_at=datetime('now') WHERE id=?`)
    .run(cat(b.category), b.title_fa || "", b.title_en || "", b.body_fa || "", b.body_en || "", Number(b.ord) || 0, b.published === 0 ? 0 : 1, id);
  persistNow();
}
export function deleteArticle(id) {
  db.prepare("DELETE FROM help_articles WHERE id=?").run(id);
  persistNow();
}
