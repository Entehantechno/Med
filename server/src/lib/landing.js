/* landing.js — Social-proof engine for the marketing landing page.

   Best-practice research (SaaS landing pages, 2025-2026) says social proof must
   be SPECIFIC and BELIEVABLE — real numbers, real named testimonials, trust
   badges near the CTA, and an FAQ that kills objections. This module powers all
   of that from the database so it's never a hard-coded lie:

   • getLiveStats()  — real counts pulled from the DB (learners, questions,
     topics, XP, accuracy) with an admin-configurable DISPLAY FLOOR so a fresh
     install doesn't show an unappealing "3 users". The floor never LOWERS a real
     number — once the real value passes the floor, the real value is shown.
   • listTestimonials / listFaqs / listBadges — published rows for the public.

   All write helpers call persistNow() (sql.js WASM flush). */
import { db, persistNow } from "../db.js";
import { getGameConfig } from "./gameconfig.js";

/* ---- helpers ---- */
function n(sql, params = []) {
  try { const r = db.prepare(sql).get(...params); return r ? Number(Object.values(r)[0]) || 0 : 0; }
  catch { return 0; }
}

/* Round a real number to a friendly "12,400+" style figure for display — but
   ALWAYS based on the REAL number (never inflated). The threshold only decides
   whether the stat is shown at all; it never changes the displayed value.
   Returns { value, display } or null when the stat should be HIDDEN.

   Rule (honest social proof):
     • real < threshold  → return null  (hide the stat entirely — no fake number)
     • real >= threshold → show the real number, nicely rounded, with a "+" */
function friendly(real, threshold) {
  const t = Math.max(0, threshold || 0);
  // Hidden until the REAL count reaches the threshold.
  if (real < t || real <= 0) return null;
  let rounded = real;
  if (real >= 1000) rounded = Math.floor(real / 100) * 100;      // nearest 100
  if (real >= 10000) rounded = Math.floor(real / 1000) * 1000;   // nearest 1k
  if (real >= 100000) rounded = Math.floor(real / 10000) * 10000;
  const grouped = rounded.toLocaleString("en-US");
  // add "+" only when we actually rounded down (so it stays truthful)
  return { value: rounded, display: grouped + (rounded < real ? "+" : "") };
}

/* Real, live platform stats for the landing hero + "by the numbers" bar.
   Config knob: landing.stats_floor = { learners, questions, topics, xp }
   Here the number acts as a *visibility threshold*: a stat is HIDDEN (null)
   until the REAL value reaches it, and then the REAL value is shown. This is
   honest — we never display a number the site hasn't actually earned. */
export function getLiveStats() {
  const cfg = getGameConfig().landing || {};
  const floor = cfg.stats_floor || {};

  // real counts
  const users = n("SELECT COUNT(*) c FROM users");
  const learners = n("SELECT COUNT(*) c FROM users WHERE role='learner'");
  const questions = n("SELECT COUNT(*) c FROM flashcards WHERE active=1");
  const topics = n("SELECT COUNT(*) c FROM topics");
  const xpReal = n("SELECT COALESCE(SUM(xp),0) c FROM learner_profiles");
  const answered = n("SELECT COUNT(*) c FROM card_attempts");
  const correct = n("SELECT COALESCE(SUM(correct),0) c FROM card_attempts");
  const accuracy = answered ? Math.round((correct / answered) * 100) : 0;

  const fUsers = friendly(users, floor.learners ?? 0);
  const fQuestions = friendly(questions, floor.questions ?? 0);
  // topics: hide until it reaches the threshold, else show the real count
  const topicsThreshold = Math.max(0, floor.topics ?? 0);
  const fTopics = topics >= topicsThreshold && topics > 0 ? { value: topics, display: String(topics) } : null;
  const fXp = friendly(xpReal, floor.xp ?? 0);
  const accThreshold = Math.max(0, floor.accuracy ?? 0);
  const accVisible = accuracy > 0 && accuracy >= accThreshold ? accuracy : null;

  return {
    // null → the client simply omits that stat card (no fake numbers, ever)
    learners: fUsers ? fUsers.display : null,
    questions: fQuestions ? fQuestions.display : null,
    topics: fTopics ? fTopics.display : null,
    xp: fXp ? fXp.display : null,
    accuracy: accVisible,
    // raw values are handy for the admin panel ("real vs shown")
    raw: { users, learners: users, learnerAccounts: learners, questions, topics, xp: xpReal, answered, accuracy },
  };
}

/* ---- Testimonials ---- */
export function listTestimonials({ publishedOnly = true } = {}) {
  const where = publishedOnly ? "WHERE published=1" : "";
  return db.prepare(`SELECT * FROM testimonials ${where} ORDER BY featured DESC, ord ASC, id ASC`).all();
}
export function serializeTestimonial(t, lang = "fa") {
  const fa = lang !== "en";
  return {
    id: t.id,
    name: (fa ? t.name_fa : t.name_en) || t.name_fa || t.name_en || "",
    role: (fa ? t.role_fa : t.role_en) || t.role_fa || t.role_en || "",
    quote: (fa ? t.quote_fa : t.quote_en) || t.quote_fa || t.quote_en || "",
    photo: t.photo || null,
    rating: t.rating || 5,
    featured: !!t.featured,
  };
}
export function createTestimonial(d = {}) {
  const info = db.prepare(`INSERT INTO testimonials
    (name_fa,name_en,role_fa,role_en,quote_fa,quote_en,photo,rating,featured,ord,published)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
    d.name_fa || null, d.name_en || null, d.role_fa || null, d.role_en || null,
    d.quote_fa || null, d.quote_en || null, d.photo || null,
    clampRating(d.rating), d.featured ? 1 : 0, d.ord | 0, d.published === 0 ? 0 : 1);
  persistNow();
  return db.prepare("SELECT * FROM testimonials WHERE id=?").get(info.lastInsertRowid);
}
export function updateTestimonial(id, d = {}) {
  const cur = db.prepare("SELECT * FROM testimonials WHERE id=?").get(id);
  if (!cur) return null;
  const m = (k, def) => (d[k] === undefined ? def : d[k]);
  db.prepare(`UPDATE testimonials SET name_fa=?,name_en=?,role_fa=?,role_en=?,quote_fa=?,quote_en=?,
    photo=?,rating=?,featured=?,ord=?,published=?,updated_at=datetime('now') WHERE id=?`).run(
    m("name_fa", cur.name_fa), m("name_en", cur.name_en), m("role_fa", cur.role_fa), m("role_en", cur.role_en),
    m("quote_fa", cur.quote_fa), m("quote_en", cur.quote_en), m("photo", cur.photo),
    clampRating(m("rating", cur.rating)), m("featured", cur.featured) ? 1 : 0,
    m("ord", cur.ord) | 0, m("published", cur.published) ? 1 : 0, id);
  persistNow();
  return db.prepare("SELECT * FROM testimonials WHERE id=?").get(id);
}
export function deleteTestimonial(id) {
  db.prepare("DELETE FROM testimonials WHERE id=?").run(id);
  persistNow();
  return true;
}
function clampRating(r) { r = Number(r) || 5; return Math.max(1, Math.min(5, r)); }

/* ---- Landing FAQ ---- */
export function listFaqs({ publishedOnly = true } = {}) {
  const where = publishedOnly ? "WHERE published=1" : "";
  return db.prepare(`SELECT * FROM landing_faqs ${where} ORDER BY ord ASC, id ASC`).all();
}
export function serializeFaq(f, lang = "fa") {
  const fa = lang !== "en";
  return {
    id: f.id,
    q: (fa ? f.q_fa : f.q_en) || f.q_fa || f.q_en || "",
    a: (fa ? f.a_fa : f.a_en) || f.a_fa || f.a_en || "",
  };
}
export function createFaq(d = {}) {
  const info = db.prepare(`INSERT INTO landing_faqs (q_fa,q_en,a_fa,a_en,ord,published) VALUES (?,?,?,?,?,?)`)
    .run(d.q_fa || null, d.q_en || null, d.a_fa || null, d.a_en || null, d.ord | 0, d.published === 0 ? 0 : 1);
  persistNow();
  return db.prepare("SELECT * FROM landing_faqs WHERE id=?").get(info.lastInsertRowid);
}
export function updateFaq(id, d = {}) {
  const cur = db.prepare("SELECT * FROM landing_faqs WHERE id=?").get(id);
  if (!cur) return null;
  const m = (k, def) => (d[k] === undefined ? def : d[k]);
  db.prepare(`UPDATE landing_faqs SET q_fa=?,q_en=?,a_fa=?,a_en=?,ord=?,published=?,updated_at=datetime('now') WHERE id=?`)
    .run(m("q_fa", cur.q_fa), m("q_en", cur.q_en), m("a_fa", cur.a_fa), m("a_en", cur.a_en),
      m("ord", cur.ord) | 0, m("published", cur.published) ? 1 : 0, id);
  persistNow();
  return db.prepare("SELECT * FROM landing_faqs WHERE id=?").get(id);
}
export function deleteFaq(id) {
  db.prepare("DELETE FROM landing_faqs WHERE id=?").run(id);
  persistNow();
  return true;
}

/* ---- Trust badges ---- */
export function listBadges({ publishedOnly = true } = {}) {
  const where = publishedOnly ? "WHERE published=1" : "";
  return db.prepare(`SELECT * FROM trust_badges ${where} ORDER BY ord ASC, id ASC`).all();
}
export function serializeBadge(b, lang = "fa") {
  const fa = lang !== "en";
  return { id: b.id, icon: b.icon || "check", label: (fa ? b.label_fa : b.label_en) || b.label_fa || b.label_en || "" };
}
export function createBadge(d = {}) {
  const info = db.prepare(`INSERT INTO trust_badges (icon,label_fa,label_en,ord,published) VALUES (?,?,?,?,?)`)
    .run(d.icon || "check", d.label_fa || null, d.label_en || null, d.ord | 0, d.published === 0 ? 0 : 1);
  persistNow();
  return db.prepare("SELECT * FROM trust_badges WHERE id=?").get(info.lastInsertRowid);
}
export function updateBadge(id, d = {}) {
  const cur = db.prepare("SELECT * FROM trust_badges WHERE id=?").get(id);
  if (!cur) return null;
  const m = (k, def) => (d[k] === undefined ? def : d[k]);
  db.prepare(`UPDATE trust_badges SET icon=?,label_fa=?,label_en=?,ord=?,published=? WHERE id=?`)
    .run(m("icon", cur.icon), m("label_fa", cur.label_fa), m("label_en", cur.label_en),
      m("ord", cur.ord) | 0, m("published", cur.published) ? 1 : 0, id);
  persistNow();
  return db.prepare("SELECT * FROM trust_badges WHERE id=?").get(id);
}
export function deleteBadge(id) {
  db.prepare("DELETE FROM trust_badges WHERE id=?").run(id);
  persistNow();
  return true;
}

/* Everything the public Landing page needs in one call. */
export function publicLanding(lang = "fa") {
  return {
    stats: getLiveStats(),
    testimonials: listTestimonials().map((t) => serializeTestimonial(t, lang)),
    faqs: listFaqs().map((f) => serializeFaq(f, lang)),
    badges: listBadges().map((b) => serializeBadge(b, lang)),
  };
}
