/* blog.js — Medical education blog / articles (public, SEO-optimized).

   AI-FREE, deterministic. Gives MED School a content-marketing surface that
   attracts organic search traffic (the natural complement to the SEO pack):
   physician-authored articles with E-E-A-T signals (named author + credentials,
   "medically reviewed" badge), reading time, categories, tags, related posts,
   a table of contents, and Article/MedicalWebPage + FAQ JSON-LD.

   Markdown is rendered to SAFE HTML by a tiny built-in renderer (no external
   deps): headings (with slug ids for the TOC), bold/italic/code, links, lists,
   blockquotes, tables and paragraphs. All user/admin HTML is escaped first, so
   the output is XSS-safe by construction. */
import { db, persistNow } from "../db.js";

const WORDS_PER_MIN = 200;

/* ------------------------------------------------------------- utilities --- */
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
export function slugify(s) {
  return String(s || "")
    .trim().toLowerCase()
    .replace(/['"]/g, "")
    // keep unicode letters/numbers (Persian included); turn the rest into dashes
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "post";
}
function headingId(text, used) {
  let base = slugify(text);
  let id = base, i = 2;
  while (used.has(id)) { id = `${base}-${i++}`; }
  used.add(id);
  return id;
}
function readingTime(md) {
  const words = String(md || "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MIN));
}

/* Extract the h2/h3 headings for a table of contents. */
export function extractToc(md) {
  const used = new Set();
  const toc = [];
  for (const line of String(md || "").split(/\r?\n/)) {
    const m = /^(#{2,3})\s+(.*)$/.exec(line.trim());
    if (m) toc.push({ level: m[1].length, text: m[2].trim(), id: headingId(m[2].trim(), used) });
  }
  return toc;
}

/* Minimal, safe Markdown → HTML. Input is escaped first (XSS-safe). */
export function renderMarkdown(md) {
  const src = String(md || "");
  const usedIds = new Set();
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let i = 0;

  const safeUrl = (url) => {
    const u = String(url || "");
    if (/^https?:\/\//i.test(u)) return u;
    if (u.startsWith("/") && !u.startsWith("//")) return u;
    return "#";
  };
  const inline = (t) => {
    let s = esc(t);
    // inline code first (protect from other rules)
    s = s.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
    // images ![alt](url) BEFORE links (same bracket syntax, leading !)
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, url) =>
      `<img src="${safeUrl(url)}" alt="${alt}" loading="lazy" />`);
    // links [text](url) — only http(s)/relative, no javascript:
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, txt, url) => {
      const safe = safeUrl(url);
      const ext = /^https?:/i.test(safe);
      return `<a href="${safe}"${ext ? ' target="_blank" rel="noopener noreferrer nofollow"' : ""}>${txt}</a>`;
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
    return s;
  };

  while (i < lines.length) {
    let line = lines[i];
    const t = line.trim();

    if (!t) { i++; continue; }

    // fenced code block ```lang ... ```
    if (/^```/.test(t)) {
      const lang = t.replace(/^```/, "").trim();
      const buf = []; i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) { buf.push(lines[i]); i++; }
      i++; // skip closing fence
      out.push(`<pre><code${lang ? ` class="lang-${esc(lang)}"` : ""}>${esc(buf.join("\n"))}</code></pre>`);
      continue;
    }

    // standalone image on its own line → figure (with optional caption via alt)
    const imOnly = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(t);
    if (imOnly) {
      const alt = imOnly[1];
      const raw = imOnly[2];
      const url = /^https?:\/\//i.test(raw) || (raw.startsWith("/") && !raw.startsWith("//")) ? raw : "#";
      out.push(`<figure class="blog-figure"><img src="${url}" alt="${esc(alt)}" loading="lazy" />${alt ? `<figcaption>${esc(alt)}</figcaption>` : ""}</figure>`);
      i++; continue;
    }

    // heading
    let hm = /^(#{1,6})\s+(.*)$/.exec(t);
    if (hm) {
      const lvl = Math.min(hm[1].length, 4);
      const id = headingId(hm[2].trim(), usedIds);
      out.push(`<h${lvl} id="${id}">${inline(hm[2].trim())}</h${lvl}>`);
      i++; continue;
    }

    // blockquote
    if (/^>\s?/.test(t)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) { buf.push(lines[i].trim().replace(/^>\s?/, "")); i++; }
      out.push(`<blockquote>${inline(buf.join(" "))}</blockquote>`);
      continue;
    }

    // table (| a | b |) with a separator row
    if (/^\|.*\|$/.test(t) && i + 1 < lines.length && /^\|[-:\s|]+\|$/.test(lines[i + 1].trim())) {
      const parseRow = (r) => r.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = parseRow(lines[i]); i += 2;
      const rows = [];
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) { rows.push(parseRow(lines[i])); i++; }
      let html = "<table><thead><tr>" + head.map((c) => `<th>${inline(c)}</th>`).join("") + "</tr></thead><tbody>";
      for (const r of rows) html += "<tr>" + r.map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>";
      html += "</tbody></table>";
      out.push(html);
      continue;
    }

    // unordered list
    if (/^[-*]\s+/.test(t)) {
      const buf = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) { buf.push(lines[i].trim().replace(/^[-*]\s+/, "")); i++; }
      out.push("<ul>" + buf.map((b) => `<li>${inline(b)}</li>`).join("") + "</ul>");
      continue;
    }
    // ordered list
    if (/^\d+\.\s+/.test(t)) {
      const buf = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) { buf.push(lines[i].trim().replace(/^\d+\.\s+/, "")); i++; }
      out.push("<ol>" + buf.map((b) => `<li>${inline(b)}</li>`).join("") + "</ol>");
      continue;
    }

    // horizontal rule
    if (/^---+$/.test(t)) { out.push("<hr />"); i++; continue; }

    // paragraph (gather until blank line)
    const buf = [t];
    i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|>\s?|[-*]\s|\d+\.\s|\|)/.test(lines[i].trim())) {
      buf.push(lines[i].trim()); i++;
    }
    out.push(`<p>${inline(buf.join(" "))}</p>`);
  }
  return out.join("\n");
}

/* ----------------------------------------------------------- data access --- */
const L = (row, field, lang) => (lang === "en" ? row[`${field}_en`] : row[`${field}_fa`]) || row[`${field}_fa`] || row[`${field}_en`] || "";

export function listCategories() {
  const builtin = ["general", "cardiology", "internal", "surgery", "pediatrics", "emergency", "study-skills", "exam-prep"];
  // merge in any custom categories already used by posts (so they persist once
  // an author types a new one in the editor) — deduped, built-ins first.
  let used = [];
  try { used = db.prepare("SELECT DISTINCT category FROM blog_posts WHERE category IS NOT NULL AND category<>''").all().map((r) => r.category); }
  catch { used = []; }
  return [...new Set([...builtin, ...used])];
}

/* Public list: only published, newest first, optional category/tag filter. */
export function listPosts({ lang = "fa", category = null, tag = null, publishedOnly = true, limit = 100 } = {}) {
  let sql = "SELECT * FROM blog_posts";
  const where = [];
  const args = [];
  if (publishedOnly) where.push("published=1");
  if (category) { where.push("category=?"); args.push(category); }
  if (where.length) sql += " WHERE " + where.join(" AND ");
  sql += " ORDER BY featured DESC, COALESCE(published_at, created_at) DESC, id DESC LIMIT ?";
  args.push(limit);
  let rows = db.prepare(sql).all(...args);
  if (tag) rows = rows.filter((r) => (r.tags || "").split(",").map((x) => x.trim().toLowerCase()).includes(String(tag).toLowerCase()));
  return rows.map((r) => summarize(r, lang));
}

export function summarize(r, lang = "fa") {
  return {
    id: r.id, slug: r.slug, category: r.category,
    title: L(r, "title", lang),
    excerpt: L(r, "excerpt", lang),
    cover: r.cover || null,
    tags: (r.tags || "").split(",").map((t) => t.trim()).filter(Boolean),
    author: r.author_name || null,
    credentials: r.author_credentials || null,
    reviewed: !!r.reviewed,
    featured: !!r.featured,
    views: r.views || 0,
    reading_time: readingTime(L(r, "body", lang)),
    published_at: r.published_at || r.created_at,
    updated_at: r.updated_at,
    // SEO: dedicated meta overrides (fall back to title/excerpt when blank)
    meta_title: L(r, "meta_title", lang) || L(r, "title", lang),
    meta_desc: L(r, "meta_desc", lang) || L(r, "excerpt", lang),
    canonical: r.canonical || null,
    scheduled_at: r.scheduled_at || null,
  };
}

/* Full post by slug (rendered HTML + TOC + related). Increments views. */
export function getPost(slug, lang = "fa", { countView = true } = {}) {
  const r = db.prepare("SELECT * FROM blog_posts WHERE slug=? AND published=1").get(slug);
  if (!r) return null;
  if (countView) { db.prepare("UPDATE blog_posts SET views=views+1 WHERE id=?").run(r.id); persistNow(); }
  const body = L(r, "body", lang);
  const related = db.prepare(
    "SELECT * FROM blog_posts WHERE published=1 AND category=? AND id<>? ORDER BY COALESCE(published_at,created_at) DESC LIMIT 3"
  ).all(r.category, r.id).map((x) => summarize(x, lang));
  return {
    ...summarize(r, lang),
    body_html: renderMarkdown(body),
    toc: extractToc(body),
    related,
    title_fa: r.title_fa, title_en: r.title_en, // for lang toggle on client if needed
  };
}

/* Slugs of published posts (for sitemap). */
export function publishedSlugs() {
  return db.prepare("SELECT slug, updated_at, published_at, created_at FROM blog_posts WHERE published=1 ORDER BY id DESC").all();
}

/* Article + FAQ JSON-LD for a post (SEO rich results). */
export function postJsonLd(slug, lang = "fa", siteUrl = "https://medschool.ir") {
  const r = db.prepare("SELECT * FROM blog_posts WHERE slug=? AND published=1").get(slug);
  if (!r) return null;
  const base = String(siteUrl).replace(/\/+$/, "");
  const node = {
    "@context": "https://schema.org",
    "@type": ["Article", "MedicalWebPage"],
    headline: L(r, "title", lang),
    description: L(r, "excerpt", lang),
    inLanguage: lang === "en" ? "en-US" : "fa-IR",
    datePublished: r.published_at || r.created_at,
    dateModified: r.updated_at || r.published_at || r.created_at,
    mainEntityOfPage: `${base}/blog/${r.slug}`,
    url: `${base}/blog/${r.slug}`,
  };
  if (r.cover) node.image = /^https?:/i.test(r.cover) ? r.cover : base + r.cover;
  if (r.author_name) {
    node.author = { "@type": "Person", name: r.author_name };
    if (r.author_credentials) node.author.jobTitle = r.author_credentials;
  }
  if (r.reviewed && r.author_name) {
    node.reviewedBy = { "@type": "Person", name: r.author_name, jobTitle: r.author_credentials || undefined };
  }
  node.publisher = { "@type": "Organization", name: "MED School", url: base };
  return node;
}

/* ------------------------------------------------------------- admin CRUD -- */
const COLS = ["slug", "category", "title_fa", "title_en", "excerpt_fa", "excerpt_en",
  "body_fa", "body_en", "cover", "tags", "author_name", "author_credentials",
  "reviewed", "published", "featured", "ord"];

function uniqueSlug(desired, exceptId = null) {
  let base = slugify(desired);
  let s = base, n = 2;
  while (true) {
    const row = db.prepare("SELECT id FROM blog_posts WHERE slug=?").get(s);
    if (!row || row.id === exceptId) return s;
    s = `${base}-${n++}`;
  }
}

export function adminList() {
  return db.prepare("SELECT * FROM blog_posts ORDER BY COALESCE(published_at,created_at) DESC, id DESC").all()
    .map((r) => ({
      id: r.id, slug: r.slug, category: r.category, tags: r.tags,
      title_fa: r.title_fa, title_en: r.title_en,
      published: !!r.published, featured: !!r.featured, reviewed: !!r.reviewed,
      views: r.views, author_name: r.author_name, updated_at: r.updated_at,
      published_at: r.published_at, scheduled_at: r.scheduled_at,
    }));
}

export function adminGet(id) {
  return db.prepare("SELECT * FROM blog_posts WHERE id=?").get(id);
}

export function createPost(d = {}) {
  const slug = uniqueSlug(d.slug || d.title_fa || d.title_en || "post");
  const pubAt = d.published ? (d.published_at || new Date().toISOString()) : null;
  const info = db.prepare(`INSERT INTO blog_posts
    (slug, category, title_fa, title_en, excerpt_fa, excerpt_en, body_fa, body_en, cover, tags,
     author_name, author_credentials, reviewed, published, featured, ord, published_at,
     meta_title_fa, meta_title_en, meta_desc_fa, meta_desc_en, canonical, scheduled_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    slug, d.category || "general", d.title_fa || "", d.title_en || "", d.excerpt_fa || "", d.excerpt_en || "",
    d.body_fa || "", d.body_en || "", d.cover || null, d.tags || "",
    d.author_name || "", d.author_credentials || "", d.reviewed ? 1 : 0, d.published ? 1 : 0, d.featured ? 1 : 0,
    Number(d.ord) || 0, pubAt,
    d.meta_title_fa || "", d.meta_title_en || "", d.meta_desc_fa || "", d.meta_desc_en || "",
    d.canonical || "", d.scheduled_at || null
  );
  persistNow();
  return adminGet(info.lastInsertRowid);
}

export function updatePost(id, d = {}, editor = null) {
  const cur = db.prepare("SELECT * FROM blog_posts WHERE id=?").get(id);
  if (!cur) return null;
  // snapshot the CURRENT version before overwriting (edit history / restore)
  saveRevision(cur, editor);
  const slug = d.slug !== undefined ? uniqueSlug(d.slug || cur.slug, id) : cur.slug;
  const willPublish = d.published !== undefined ? (d.published ? 1 : 0) : cur.published;
  // set published_at the first time it becomes published
  let pubAt = cur.published_at;
  if (willPublish && !cur.published_at) pubAt = d.published_at || new Date().toISOString();
  db.prepare(`UPDATE blog_posts SET
    slug=?, category=?, title_fa=?, title_en=?, excerpt_fa=?, excerpt_en=?, body_fa=?, body_en=?,
    cover=?, tags=?, author_name=?, author_credentials=?, reviewed=?, published=?, featured=?, ord=?,
    published_at=?, meta_title_fa=?, meta_title_en=?, meta_desc_fa=?, meta_desc_en=?, canonical=?, scheduled_at=?,
    updated_at=datetime('now') WHERE id=?`).run(
    slug, d.category ?? cur.category, d.title_fa ?? cur.title_fa, d.title_en ?? cur.title_en,
    d.excerpt_fa ?? cur.excerpt_fa, d.excerpt_en ?? cur.excerpt_en, d.body_fa ?? cur.body_fa, d.body_en ?? cur.body_en,
    d.cover ?? cur.cover, d.tags ?? cur.tags, d.author_name ?? cur.author_name, d.author_credentials ?? cur.author_credentials,
    d.reviewed !== undefined ? (d.reviewed ? 1 : 0) : cur.reviewed, willPublish,
    d.featured !== undefined ? (d.featured ? 1 : 0) : cur.featured, d.ord !== undefined ? Number(d.ord) || 0 : cur.ord,
    pubAt,
    d.meta_title_fa ?? cur.meta_title_fa, d.meta_title_en ?? cur.meta_title_en,
    d.meta_desc_fa ?? cur.meta_desc_fa, d.meta_desc_en ?? cur.meta_desc_en,
    d.canonical ?? cur.canonical, d.scheduled_at !== undefined ? (d.scheduled_at || null) : cur.scheduled_at,
    id
  );
  persistNow();
  return adminGet(id);
}

/* ---- Edit history (revisions) ---- */
// Save a snapshot of a post row. Keeps the most recent 30 per post (prune old).
function saveRevision(row, editor = null) {
  try {
    db.prepare("INSERT INTO blog_revisions (post_id, data_json, editor) VALUES (?,?,?)")
      .run(row.id, JSON.stringify(row), editor || null);
    // prune: keep only the newest 30 revisions per post
    db.prepare(`DELETE FROM blog_revisions WHERE post_id=? AND id NOT IN
      (SELECT id FROM blog_revisions WHERE post_id=? ORDER BY id DESC LIMIT 30)`).run(row.id, row.id);
  } catch { /* revisions are best-effort; never block an edit */ }
}

// List revisions for a post (newest first) with a light summary for the UI.
export function listRevisions(postId) {
  const rows = db.prepare("SELECT id, data_json, editor, created_at FROM blog_revisions WHERE post_id=? ORDER BY id DESC").all(postId);
  return rows.map((r) => {
    let d = {}; try { d = JSON.parse(r.data_json); } catch { d = {}; }
    return {
      id: r.id, editor: r.editor, created_at: r.created_at,
      title_fa: d.title_fa, title_en: d.title_en,
      published: !!d.published,
      words_fa: (String(d.body_fa || "").trim().match(/\S+/g) || []).length,
    };
  });
}

// Full snapshot of one revision (for preview / diff on the client).
export function getRevision(postId, revId) {
  const r = db.prepare("SELECT * FROM blog_revisions WHERE id=? AND post_id=?").get(revId, postId);
  if (!r) return null;
  let d = {}; try { d = JSON.parse(r.data_json); } catch { d = {}; }
  return { id: r.id, editor: r.editor, created_at: r.created_at, snapshot: d };
}

// Restore a revision: snapshots the CURRENT version first (so restore is
// itself undoable), then writes the old content back over the post.
export function restoreRevision(postId, revId, editor = null) {
  const r = db.prepare("SELECT * FROM blog_revisions WHERE id=? AND post_id=?").get(revId, postId);
  if (!r) return null;
  let snap = {}; try { snap = JSON.parse(r.data_json); } catch { return null; }
  // updatePost snapshots current first, then applies these fields.
  return updatePost(postId, {
    slug: snap.slug, category: snap.category,
    title_fa: snap.title_fa, title_en: snap.title_en,
    excerpt_fa: snap.excerpt_fa, excerpt_en: snap.excerpt_en,
    body_fa: snap.body_fa, body_en: snap.body_en,
    cover: snap.cover, tags: snap.tags,
    author_name: snap.author_name, author_credentials: snap.author_credentials,
    reviewed: snap.reviewed, featured: snap.featured,
    meta_title_fa: snap.meta_title_fa, meta_title_en: snap.meta_title_en,
    meta_desc_fa: snap.meta_desc_fa, meta_desc_en: snap.meta_desc_en,
    canonical: snap.canonical,
    // keep current published/scheduled state; restore is about CONTENT
  }, editor);
}

/* Auto-publish any post whose scheduled_at time has arrived. Called lazily on
   public blog reads (no cron needed). Returns the number of posts published. */
export function publishScheduled() {
  const now = new Date().toISOString();
  const due = db.prepare(
    "SELECT id, published_at FROM blog_posts WHERE published=0 AND scheduled_at IS NOT NULL AND scheduled_at<=?"
  ).all(now);
  if (!due.length) return 0;
  const upd = db.prepare("UPDATE blog_posts SET published=1, published_at=COALESCE(published_at, scheduled_at), scheduled_at=NULL, updated_at=datetime('now') WHERE id=?");
  for (const p of due) upd.run(p.id);
  persistNow();
  return due.length;
}

export function deletePost(id) {
  db.prepare("DELETE FROM blog_posts WHERE id=?").run(id);
  db.prepare("DELETE FROM blog_revisions WHERE post_id=?").run(id);
  persistNow();
  return { ok: true };
}

export function blogStats() {
  const total = db.prepare("SELECT COUNT(*) c FROM blog_posts").get()?.c || 0;
  const published = db.prepare("SELECT COUNT(*) c FROM blog_posts WHERE published=1").get()?.c || 0;
  const views = db.prepare("SELECT COALESCE(SUM(views),0) v FROM blog_posts").get()?.v || 0;
  const top = db.prepare("SELECT slug, title_fa, title_en, views FROM blog_posts WHERE published=1 ORDER BY views DESC LIMIT 5").all();
  return { total, published, drafts: total - published, views, top };
}

/* Idempotent default university education posts.
   These two are full articles, not stubs: they explain the pedagogy behind the
   two university-only features (virtual patients, hint-based questions), cite
   the evidence, and end with practical advice. `ensureDefaultEducationPosts`
   upgrades an existing stub in place, so installs that already shipped the
   short placeholder get the real article on next boot. */
const DEFAULT_EDU_POSTS_FINAL = [
  { slug:"virtual-patient-osce-medical-education", category:"medical-education",
    title_fa:"بیمار مجازی و OSCE در آموزش پزشکی؛ از تمرین شرح‌حال تا ارزیابی استاد",
    title_en:"Virtual patients and OSCE in medical education",
    excerpt_fa:"بیمار مجازی شکاف میان «دانستن» و «انجام دادن» را پر می‌کند. مروری بر شواهد، نسبتش با OSCE و اینکه در MED School چطور کار می‌کند.",
    excerpt_en:"Virtual patients close the gap between knowing and doing. The evidence, how they relate to the OSCE, and how they work in MED School.",
    meta_title_fa:"بیمار مجازی و OSCE در آموزش پزشکی | MED School",
    meta_title_en:"Virtual patients and OSCE in medical education | MED School",
    meta_desc_fa:"چرا بیمار مجازی استدلال بالینی را بهتر از سؤال چهارگزینه‌ای می‌سازد، شواهد پژوهشی آن و نقشش در آمادگی و اجرای OSCE.",
    meta_desc_en:"Why virtual patients build clinical reasoning better than MCQs, the research evidence, and their role in OSCE preparation and delivery.",
    body_fa:`## چرا بیمار مجازی، و نه فقط تمرین روی کاغذ؟

دانشجوی پزشکی می‌تواند صد سؤال چهارگزینه‌ای درباره‌ی درد قفسه‌ی سینه درست جواب بدهد و باز هم سر بالین بیمار نداند از کجا شروع کند. دلیلش ساده است: سؤال چهارگزینه‌ای «دانستن» را می‌سنجد، اما طبابت «انجام دادن» است. بیمار مجازی دقیقاً همین شکاف را پر می‌کند؛ سناریویی که در آن شما باید خودتان تصمیم بگیرید چه بپرسید، چه معاینه کنید و چه آزمایشی بفرستید — و هر تصمیم هزینه و نتیجه دارد.

شواهد این ادعا هم کم نیست. در دانشکده‌ی پزشکی دوک، ۱۱۷ دانشجوی سال اول در یک برنامه‌ی استدلال بالینی شرکت کردند که ستون اصلی‌اش ۱۶ مواجهه‌ی بیمار مجازی بود؛ عملکرد آن‌ها در همین مواجهه‌ها توانست دانشجویانی را که بعداً در OSCE و دوره‌ی کارورزی ضعیف ظاهر می‌شدند، از پیش شناسایی کند. یعنی بیمار مجازی نه‌تنها آموزش می‌دهد، بلکه **پیش‌بینی هم می‌کند**.

## بیمار مجازی چه چیزی را می‌سازد که کلاس نمی‌سازد

**۱. تصمیم‌گیری در شرایط عدم قطعیت.** در کتاب، تشخیص از قبل معلوم است و شما فقط درمانش را می‌خوانید. در بیمار مجازی، شما با یک شکایت روبه‌رو می‌شوید و باید از دل ابهام به تشخیص برسید. این همان مهارتی است که در آزمون‌های کیس‌محور و در بخش سنجیده می‌شود.

**۲. تکرار بدون خطر.** یک بیمار واقعی را نمی‌توان ده بار از اول ویزیت کرد. یک بیمار مجازی را می‌توان. همین تکرارِ عمدی است که در پژوهش‌های آموزش پزشکی «تمرین آگاهانه» نامیده می‌شود و مؤثرترین مسیر شناخته‌شده برای رسیدن به مهارت پایدار است.

**۳. کاهش اضطراب پیش از مواجهه‌ی واقعی.** مطالعات نشان داده‌اند دانشجویانی که پیش از OSCE با سناریوهای شبیه‌سازی‌شده تمرین کرده‌اند، اعتمادبه‌نفس بالاتر و اضطراب کمتری گزارش می‌کنند. ترسِ «نمی‌دانم اتاق بعدی چه خبر است» با تمرین قبلی کوچک می‌شود.

**۴. بازخورد فوری و مشخص.** در بخش، ممکن است هفته‌ها بگذرد تا کسی به شما بگوید سؤال کلیدی شرح‌حال را نپرسیده‌اید. در بیمار مجازی، بازخورد بلافاصله پس از تصمیم می‌آید — و بازخورد فوری چند برابر بازخورد تأخیری اثر دارد.

## نسبت بیمار مجازی با OSCE

OSCE سال‌هاست استاندارد سنجش مهارت بالینی است، اما گران و پرزحمت است: بیمار استاندارد، اتاق، مصحح و زمان‌بندی دقیق می‌خواهد. اینجاست که بیمار مجازی دو نقش پیدا می‌کند.

**نقش اول، تمرین پیش از OSCE.** دانشجو با فرمت مواجهه آشنا می‌شود، می‌فهمد چک‌لیست چطور نمره می‌دهد و وارد ایستگاه واقعی می‌شود بدون آنکه اولین بارش باشد.

**نقش دوم، بخشی از خود آزمون.** یک مطالعه‌ی مقایسه‌ای روی دانشجویان سال پنجم نشان داد ایستگاه شبیه‌سازی‌شده، سطح دشواری مشابه ایستگاه فیزیکی داشت اما **قدرت تفکیک بهتری** بین دانشجوی قوی و ضعیف نشان داد. در تجربه‌ای دیگر با ۵۸۶ دانشجو، آزمون بیمار مجازی پایایی بالاتری (کرونباخ آلفای حدود ۰٫۸۶) از امتحان شفاهی بالینی داشت.

نکته‌ی مهم این است که این دو با هم رقیب نیستند. بیمار مجازی چیزهایی را می‌سنجد که OSCE نمی‌سنجد و برعکس؛ لمس بیمار، برخورد انسانی و مهارت دست هرگز جای خود را به صفحه‌نمایش نمی‌دهند.

## در MED School چطور کار می‌کند

بیمار مجازی در MED School برای **اکانت‌های دانشگاهی** طراحی شده و سه لایه دارد:

- **برای دانشجو:** سناریوی بیمار را باز می‌کنید، شرح‌حال می‌گیرید، معاینه و پاراکلینیک انتخاب می‌کنید و به تشخیص و برنامه می‌رسید. هر گام ثبت می‌شود.
- **برای استاد:** می‌بینید دانشجو چه پرسید و چه از قلم انداخت، بر اساس چک‌لیست نمره می‌دهید و بازخورد می‌نویسید. نمره‌دهی بخشی است، پس پاسخ نیمه‌درست هم امتیاز خودش را می‌گیرد.
- **برای گروه آموزشی:** الگوی خطاهای مکرر یک کلاس آشکار می‌شود؛ اگر بیست دانشجو یک سؤال کلیدی را نپرسیده‌اند، مشکل از دانشجو نیست، از آموزش است.

## چند توصیه‌ی عملی

۱. **اول تشخیص را حدس نزنید.** عادت کنید پیش از دیدن گزینه‌ها، فهرست افتراقی خودتان را بنویسید.
۲. **هر تصمیم را توجیه کنید.** اگر آزمایشی می‌فرستید، از خودتان بپرسید نتیجه‌اش قرار است کدام تصمیم را عوض کند. اگر جوابی ندارید، آن آزمایش لازم نیست.
۳. **پس از پایان، مرور کنید.** ارزش واقعی در همان چند دقیقه‌ی بازبینی است، نه در خودِ سناریو.
۴. **تکرار کنید.** یک بیمار مجازی که دو بار حل شود، بیشتر از دو بیمار مجازی که یک بار حل شوند می‌آموزاند.

> بیمار مجازی جای بالین را نمی‌گیرد. کاری که می‌کند این است که وقتی به بالین رسیدید، اولین بارتان نباشد.

---

**منابع:** مطالعه‌ی دانشگاه دوک درباره‌ی مواجهه‌های بیمار مجازی و پیش‌بینی عملکرد OSCE (Academic Medicine, 2024)؛ مقایسه‌ی ایستگاه شبیه‌سازی‌شده و فیزیکی در OSCE (JMIR, 2025)؛ تجربه‌ی پنج‌ساله‌ی سنجش با بیمار مجازی در دوره‌ی داخلی.`,
    body_en:`## Why a virtual patient, and not just paper practice?

A medical student can answer a hundred multiple-choice questions about chest pain correctly and still freeze at the bedside. The reason is simple: an MCQ measures *knowing*, while medicine is *doing*. A virtual patient closes exactly that gap — a scenario where you decide what to ask, what to examine and what to order, and every decision has a cost and a consequence.

The evidence is real. At Duke University School of Medicine, 117 first-year students followed a clinical reasoning curriculum built around 16 virtual interactive patient encounters. Their performance in those encounters identified, in advance, the students who would later underperform in the OSCE and the clerkship year. So a virtual patient does not merely teach — it **predicts**.

## What a virtual patient builds that a lecture cannot

**1. Decision-making under uncertainty.** In a textbook the diagnosis is given and you read its treatment. With a virtual patient you meet a complaint and must reach the diagnosis through the ambiguity. That is the skill case-based exams and the wards actually test.

**2. Repetition without risk.** You cannot re-interview a real patient ten times. You can re-run a virtual one. That deliberate repetition is the best-evidenced route to durable skill in medical education research.

**3. Less anxiety before the real encounter.** Students who rehearse with simulated scenarios before an OSCE report higher confidence and lower anxiety. The fear of "I don't know what is behind the next door" shrinks with rehearsal.

**4. Immediate, specific feedback.** On the wards, weeks may pass before anyone tells you that you missed the key history question. With a virtual patient the feedback arrives the moment you decide — and immediate feedback is far more powerful than delayed feedback.

## How virtual patients relate to the OSCE

The OSCE has been the standard for assessing clinical skill for decades, but it is expensive and laborious: standardised patients, rooms, examiners and precise timing. This is where virtual patients take on two roles.

**First, rehearsal before the OSCE.** The student learns the format, understands how the checklist scores, and walks into the real station without it being their first time.

**Second, part of the assessment itself.** A comparative study of fifth-year students found a simulated station had a difficulty comparable to a physical one but showed **better discrimination** between strong and weak candidates. In another programme with 586 students, the virtual-patient examination achieved higher reliability (Cronbach's alpha around 0.86) than the traditional bedside oral exam.

Importantly, the two are not rivals. Virtual patients measure things an OSCE cannot, and vice versa; touching a patient, human rapport and manual skill will never be replaced by a screen.

## How it works in MED School

The virtual patient in MED School is built for **university accounts** and has three layers:

- **For the student:** open the case, take a history, choose examinations and investigations, then commit to a diagnosis and plan. Every step is logged.
- **For the teacher:** see what the student asked and what they missed, score against a checklist and write feedback. Scoring is partial, so a half-right answer earns its share.
- **For the department:** recurring error patterns across a class become visible. If twenty students all missed the same key question, the problem is not the students — it is the teaching.

## A few practical tips

1. **Do not guess the diagnosis first.** Get into the habit of writing your own differential before you see any options.
2. **Justify every decision.** If you order a test, ask which decision its result would change. If you have no answer, you do not need the test.
3. **Review afterwards.** The real value lies in those few minutes of review, not in the scenario itself.
4. **Repeat.** One virtual patient solved twice teaches more than two solved once.

> A virtual patient does not replace the bedside. What it does is make sure that when you get there, it is not your first time.

---

**Sources:** Duke University study on virtual interactive patient encounters and OSCE performance prediction (Academic Medicine, 2024); comparison of virtual and physical OSCE stations (JMIR, 2025); five-year experience of virtual-patient assessment in an internal medicine clerkship.`,
    tags:"دانشگاهی,آموزش پزشکی,بیمار مجازی,OSCE,استدلال بالینی" },
  { slug:"hint-based-questions-scaffolded-learning", category:"medical-education",
    title_fa:"سؤالات هینت‌دار در علوم پایه و بافت‌شناسی؛ یادگیری پلکانی به جای حدس زدن",
    title_en:"Hint-based questions in basic sciences and histology",
    excerpt_fa:"هینت خوب جواب نمی‌دهد، توجه را هدایت می‌کند. نظریه‌ی بار شناختی، آناتومی یک نردبان هینت خوب و دام اتکای بیش از حد.",
    excerpt_en:"A good hint gives no answer; it directs attention. Cognitive load theory, the anatomy of a good hint ladder, and the over-reliance trap.",
    meta_title_fa:"سؤالات هینت‌دار و یادگیری پلکانی | MED School",
    meta_title_en:"Hint-based questions and scaffolded learning | MED School",
    meta_desc_fa:"چگونه سؤال هینت‌دار با کاهش بار شناختی، یادگیری بافت‌شناسی و علوم پایه را از حدس زدن به استدلال تبدیل می‌کند.",
    meta_desc_en:"How hint-based questions lower cognitive load and turn histology and basic-science study from guessing into reasoning.",
    body_fa:`## مسئله‌ای که هر استاد علوم پایه می‌شناسد

یک اسلاید بافت‌شناسی را به دانشجوی ترم سه نشان می‌دهید و می‌پرسید این چه بافتی است. دو اتفاق ممکن است بیفتد: یا جواب را می‌داند، یا حدس می‌زند. حالت دوم بدترین حالت ممکن است — نه چیزی یاد می‌گیرد و نه شما می‌فهمید کجای زنجیره‌ی استدلالش پاره شده است.

سؤال هینت‌دار برای همین ساخته شده است. به‌جای یک پرسش «همه یا هیچ»، مسیر رسیدن به پاسخ را پله‌پله باز می‌کند: اول خودت تلاش کن؛ اگر گیر کردی، یک راهنمایی بگیر؛ باز هم گیر کردی، راهنمایی بعدی. دانشجو در نهایت به پاسخ می‌رسد، اما مهم‌تر از پاسخ، **مسیری است که طی کرده**.

## پشتوانه‌ی علمی: نظریه‌ی بار شناختی

حافظه‌ی کاری ما ظرفیت بسیار محدودی دارد. وقتی دانشجو با تصویری روبه‌رو می‌شود که هم باید ساختارها را تشخیص دهد، هم اصطلاحات را به یاد بیاورد و هم بین چند گزینه‌ی مشابه تمایز بگذارد، این ظرفیت لبریز می‌شود. نتیجه‌اش این است که مغز به‌جای یادگیری، فقط دست‌وپا می‌زند.

نظریه‌ی بار شناختی سه نوع بار را از هم جدا می‌کند: بار ذاتی (سختی خودِ مطلب)، بار بیرونی (سختی‌ای که شیوه‌ی ارائه تحمیل می‌کند) و بار مفید (تلاشی که واقعاً به ساخت دانش منجر می‌شود). هدف طراحی خوب، کم کردن بار بیرونی و باز کردن جا برای بار مفید است.

راهکار شناخته‌شده‌ی این نظریه، توالی «ساده به پیچیده» است: ابتدا **مثال حل‌شده** (کل راه‌حل نشان داده می‌شود)، سپس **تکلیف نیمه‌تمام** (بخشی داده می‌شود و بقیه با دانشجوست)، و در نهایت **سؤال معمولی** بدون هیچ کمکی. سؤال هینت‌دار دقیقاً همین توالی را در یک سؤال واحد فشرده می‌کند.

## چرا «راهنمایی» با «جواب دادن» فرق دارد

اینجا ظرافت کار است. یک هینت خوب اطلاعات تازه اضافه نمی‌کند؛ **توجه را هدایت می‌کند**. تفاوت این دو جمله را ببینید:

- ❌ «این بافت اپیتلیوم مطبق سنگفرشی است.» → این جواب است، نه هینت.
- ✅ «به تعداد لایه‌های سلولی نگاه کن. یک لایه است یا چند لایه؟» → این هینت است.

هینت دوم دانشجو را وادار می‌کند خودش نگاه کند و خودش نتیجه بگیرد. در ادبیات آموزشی به این کار «داربست‌بندی» می‌گویند: ساختاری موقت که تا وقتی ساختمان روی پای خودش بایستد نگهش می‌دارد، و بعد برداشته می‌شود.

پژوهش‌ها نشان داده‌اند پرسش‌های راهنما مثل «چرا؟»، «چه شباهتی دارند؟» و «این روی آن چه اثری می‌گذارد؟» یادگیری را به‌طور معناداری عمیق‌تر می‌کنند، چون دانش پیشین را فعال و پردازش را هدفمند می‌کنند.

## آناتومی یک سؤال هینت‌دار خوب

بر اساس همین اصول، هر هینت باید یک گام از زنجیره‌ی استدلال را باز کند، نه اینکه صرفاً محدوده را تنگ‌تر کند:

| پله | نقش هینت | مثال در بافت‌شناسی |
|---|---|---|
| ۱ | جهت‌دهی به مشاهده | «اول به بزرگ‌نمایی کم نگاه کن: ساختار کلی غده‌ای است یا لوله‌ای؟» |
| ۲ | محدود کردن افتراق | «سلول‌ها یک ردیف‌اند یا چند ردیف؟» |
| ۳ | نشانه‌ی افتراقی کلیدی | «دنبال مژک بگرد؛ حضورش تشخیص را تقریباً قطعی می‌کند.» |
| ۴ | ربط به عملکرد | «این بافت کجای بدن است و چرا آنجا به این ساختار نیاز است؟» |

توجه کنید هیچ‌کدام از این چهار جمله پاسخ را نمی‌گویند، اما هر کدام یک قدم جلو می‌برند. پله‌ی چهارم مهم‌ترین است: وصل کردن ساختار به عملکرد همان چیزی است که یادگیری را از حفظ کردن جدا می‌کند.

## کجا بیشترین اثر را دارد

**بافت‌شناسی و پاتولوژی.** تشخیص تصویری ذاتاً مهارتی الگومحور است و مبتدی نمی‌داند کجا را نگاه کند. هینت دقیقاً «کجا را نگاه کن» را می‌آموزد.

**آناتومی.** به‌جای پرسیدن نام یک ساختار، می‌توان با هینت از موقعیت و مجاورت به آن رسید — همان استدلالی که سر میز تشریح لازم است.

**بیوشیمی و فیزیولوژی.** مسیرهای متابولیک و حلقه‌های تنظیمی زنجیره‌ای‌اند؛ هینت می‌تواند دانشجو را حلقه‌به‌حلقه جلو ببرد به‌جای آنکه کل مسیر را یکجا طلب کند.

## نکته‌ی مهم: هینت باید محو شود

یک هشدار جدی هم هست. اگر دانشجو یاد بگیرد همیشه روی هینت حساب کند، داربست به عصا تبدیل می‌شود. سه قاعده برای پرهیز از این دام:

۱. **همیشه اول بدون هینت تلاش کنید.** حتی تلاش ناموفق، حافظه را برای پاسخ درست آماده می‌کند.
۲. **هر هینت هزینه‌ای دارد.** در MED School گرفتن هینت امتیاز را کم می‌کند؛ این عمدی است تا هینت آخرین راه باشد نه اولین.
۳. **در مرور بعدی، بدون هینت.** سؤالی که با هینت حل شده، هنوز یاد گرفته نشده است. معیار واقعی، حل کردن همان سؤال چند روز بعد و بدون کمک است.

## در MED School چطور کار می‌کند

این قابلیت برای **اکانت‌های دانشگاهی** فعال است:

- استاد برای هر سؤال چند هینت پلکانی می‌نویسد و ترتیبشان را تعیین می‌کند.
- دانشجو در حین پاسخ می‌تواند هینت بعدی را باز کند؛ سیستم ثبت می‌کند در کدام پله گیر کرده است.
- گزارش کلاسی نشان می‌دهد بیشترین توقف در کدام پله بوده — و این دقیقاً همان نقطه‌ای است که باید در کلاس دوباره تدریس شود.

> هدف سؤال هینت‌دار این نیست که دانشجو جواب را پیدا کند. هدف این است که دفعه‌ی بعد بدون هینت پیدایش کند.

---

**منابع:** نظریه‌ی بار شناختی و توالی مثال حل‌شده تا تکلیف مستقل (Van Merriënboer و همکاران)؛ پژوهش‌ها درباره‌ی پرسش‌های راهنما و اثرشان بر عمق یادگیری؛ کاربرد داربست‌بندی در آموزش استدلال بالینی.`,
    body_en:`## A problem every basic-science teacher knows

You show a histology slide to a third-semester student and ask what tissue it is. Two things can happen: either they know, or they guess. The second is the worst case — they learn nothing, and you learn nothing about where their reasoning broke.

Hint-based questions exist for exactly this. Instead of an all-or-nothing prompt, they open the route to the answer one step at a time: try it yourself; if you are stuck, take a hint; still stuck, take the next one. The student reaches the answer, but more important than the answer is **the path they walked**.

## The science behind it: cognitive load theory

Working memory is very limited. When a student faces an image and must simultaneously recognise structures, recall terminology and discriminate between similar options, that capacity overflows. The brain ends up struggling rather than learning.

Cognitive load theory separates three loads: intrinsic (the inherent difficulty of the material), extraneous (difficulty imposed by how it is presented) and germane (the effort that actually builds knowledge). Good design lowers extraneous load to make room for germane load.

The theory's established remedy is a simple-to-complex sequence: start with a **worked example** (the full solution is shown), move to a **completion task** (part is given, the student finishes it), and end with a **conventional question** with no support at all. A hint-based question compresses that whole sequence into a single item.

## Why a hint is not an answer

This is where the craft lies. A good hint adds no new information; it **directs attention**. Compare these two:

- ❌ "This tissue is stratified squamous epithelium." → that is the answer, not a hint.
- ✅ "Look at the number of cell layers. One layer or several?" → that is a hint.

The second forces the student to look and conclude for themselves. In educational terms this is *scaffolding*: a temporary structure that holds the building until it can stand alone, then comes down.

Research shows guiding prompts such as "why?", "how are these alike?" and "how does this affect that?" meaningfully deepen learning, because they activate prior knowledge and give processing a direction.

## The anatomy of a good hint ladder

Following those principles, each hint should open one link in the reasoning chain rather than merely narrowing the field:

| Step | Role of the hint | Histology example |
|---|---|---|
| 1 | Direct the observation | "Start at low power: is the overall structure glandular or tubular?" |
| 2 | Narrow the differential | "Are the cells in one row or several?" |
| 3 | Key discriminating feature | "Look for cilia; their presence nearly settles it." |
| 4 | Link to function | "Where in the body is this tissue, and why is that structure needed there?" |

None of these four sentences gives the answer, yet each moves one step forward. Step four matters most: connecting structure to function is what separates learning from memorising.

## Where it helps most

**Histology and pathology.** Image diagnosis is inherently pattern-based and a novice does not know where to look. A hint teaches exactly that — where to look.

**Anatomy.** Instead of asking for a structure's name, hints can lead from position and relations to the answer — the same reasoning the dissection table demands.

**Biochemistry and physiology.** Metabolic pathways and regulatory loops are chains; hints can walk a student link by link instead of demanding the whole pathway at once.

## The crucial caveat: hints must fade

There is a real warning here. If a student learns to rely on hints, the scaffold becomes a crutch. Three rules avoid that trap:

1. **Always attempt it unaided first.** Even a failed attempt primes memory for the correct answer.
2. **Every hint costs something.** In MED School taking a hint reduces the score; that is deliberate, so hints are the last resort rather than the first.
3. **Review without hints.** A question solved with a hint has not yet been learned. The real test is solving it again days later, unaided.

## How it works in MED School

This feature is enabled for **university accounts**:

- The teacher writes several graded hints per question and sets their order.
- The student can open the next hint while answering; the system records which step they got stuck on.
- The class report shows where most students stalled — precisely the point that needs reteaching.

> The goal of a hint-based question is not for the student to find the answer. It is for them to find it next time without the hint.

---

**Sources:** Cognitive load theory and the worked-example-to-independent-task sequence (Van Merriënboer et al.); research on guiding question prompts and depth of learning; scaffolding in clinical reasoning instruction.`,
    tags:"دانشگاهی,آموزش پزشکی,بافت‌شناسی,علوم پایه,بار شناختی" }
];
function fixUniversityCtaTextFinal(t=""){return String(t).replace(/شروع\s*رایگان/g,"ورود").replace(/Start\s*free/gi,"Sign in").replace(/start-free/gi,"sign-in");}
export function ensureDefaultEducationPosts(){
  let n=0;
  for(const p of DEFAULT_EDU_POSTS_FINAL){
    const row=db.prepare("SELECT * FROM blog_posts WHERE slug=?").get(p.slug);
    if(!row){createPost({...p,author_name:"MED School Faculty",reviewed:1,published:1,featured:1});n++;continue}
    // An earlier release shipped these as three-line stubs. If the stored body
    // is still shorter than the real article, replace it wholesale; otherwise
    // leave admin edits alone and only normalise the sign-in wording.
    const stub = (row.body_fa||"").length < 600;
    if(stub){
      updatePost(row.id,{
        title_fa:p.title_fa,title_en:p.title_en,
        excerpt_fa:p.excerpt_fa,excerpt_en:p.excerpt_en,
        meta_title_fa:p.meta_title_fa,meta_title_en:p.meta_title_en,
        meta_desc_fa:p.meta_desc_fa,meta_desc_en:p.meta_desc_en,
        body_fa:p.body_fa,body_en:p.body_en,tags:p.tags,
      },"system-article-fill");
      n++;continue;
    }
    const fa=fixUniversityCtaTextFinal(row.body_fa||""),en=fixUniversityCtaTextFinal(row.body_en||"");
    if(fa!==row.body_fa||en!==row.body_en){updatePost(row.id,{body_fa:fa,body_en:en},"system-cta-fix");n++}
  }
  return n
}
