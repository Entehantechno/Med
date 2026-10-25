/* store.js — Video course marketplace.
   Public:  browse published courses, watch FREE-PREVIEW lessons, buy a course.
   Buyers:  watch all lessons of courses they own.
   Admin:   full CRUD over courses & lessons, choose which lessons are free
            previews, set price/discount, publish, and see enrollments.

   Purchase reuses the same payment gateway (Zarinpal / mock) as subscriptions:
   POST /api/store/courses/:id/buy -> creates a transaction (plan="course:<id>")
   and returns the gateway url; on callback verify, the buyer is enrolled. */
import { Router } from "express";
import { db, persistNow } from "../db.js";
import { authRequired, requireRole } from "../lib/auth.js";
import { requirePerm } from "../lib/rbac.js";
import { audit } from "../lib/audit.js";
import { isEnabled } from "../lib/flags.js";
import { requestPayment, verifyPayment } from "../lib/zarinpal.js";
import { fulfillCoursePurchase } from "../lib/entitlement.js";
import { publicBaseUrl } from "../lib/publicurl.js";

const r = Router();
const L = (req) => (req.query.lang === "en" ? "en" : "fa");
const adminContent = [authRequired, requirePerm("store.manage")];

function owns(userId, courseId) {
  if (!userId) return false;
  return !!db.prepare("SELECT 1 FROM course_enrollments WHERE user_id=? AND course_id=?").get(userId, courseId);
}
function effectivePrice(c) {
  const price = Math.max(0, Number(c.price) || 0);
  const disc = Number(c.discount_price);
  // A 0 (or empty) discount must NOT turn a paid course free — that was a
  // silent revenue leak when an admin left discount_price at 0.
  if (Number.isFinite(disc) && disc > 0 && disc < price) return disc;
  return price;
}

/* ---------------- PUBLIC storefront ---------------- */
// list published courses (no auth needed — it's a shop window)
const storeGate = (req, res, next) => isEnabled("store") ? next() : res.status(403).json({ error: "feature disabled", flag: "store" });
r.get("/courses", storeGate, (req, res) => {
  const lang = L(req);
  const uid = req.user?.id || null;
  const rows = db.prepare("SELECT * FROM courses WHERE published=1 ORDER BY ord, id DESC").all();
  const courses = rows.map((c) => {
    const lessons = db.prepare("SELECT COUNT(*) n, SUM(free_preview) f FROM course_lessons WHERE course_id=?").get(c.id);
    return {
      id: c.id, title: lang === "fa" ? c.title_fa : c.title_en,
      desc: lang === "fa" ? c.desc_fa : c.desc_en, cover: c.cover, level: c.level,
      instructor: lang === "fa" ? c.instructor_fa : c.instructor_en,
      price: c.price, discount_price: c.discount_price, effectivePrice: effectivePrice(c),
      lessonCount: lessons.n || 0, freeCount: lessons.f || 0,
      owned: owns(uid, c.id),
    };
  });
  res.json({ courses });
});

// course detail with its lessons; locked lessons hide the video url unless owned
r.get("/courses/:id", storeGate, (req, res) => {
  const lang = L(req);
  const uid = req.user?.id || null;
  const c = db.prepare("SELECT * FROM courses WHERE id=? AND published=1").get(req.params.id);
  if (!c) return res.status(404).json({ error: "not found" });
  const owned = owns(uid, c.id) || effectivePrice(c) === 0;
  const lessons = db.prepare("SELECT * FROM course_lessons WHERE course_id=? ORDER BY ord, id").all(c.id).map((l) => {
    const unlocked = owned || !!l.free_preview;
    return {
      id: l.id, title: lang === "fa" ? l.title_fa : l.title_en, duration: l.duration,
      free_preview: !!l.free_preview, unlocked,
      video_url: unlocked ? l.video_url : null,   // never leak locked video urls
    };
  });
  res.json({
    course: {
      id: c.id, title: lang === "fa" ? c.title_fa : c.title_en, desc: lang === "fa" ? c.desc_fa : c.desc_en,
      cover: c.cover, level: c.level, instructor: lang === "fa" ? c.instructor_fa : c.instructor_en,
      price: c.price, discount_price: c.discount_price, effectivePrice: effectivePrice(c), owned,
    },
    lessons,
  });
});

// buy a course -> create a transaction + gateway url (free courses enroll instantly)
r.post("/courses/:id/buy", storeGate, authRequired, async (req, res) => {
  const c = db.prepare("SELECT * FROM courses WHERE id=? AND published=1").get(req.params.id);
  if (!c) return res.status(404).json({ error: "not found" });
  if (owns(req.user.id, c.id)) return res.json({ owned: true });
  const price = effectivePrice(c);
  if (price <= 0) { // free course: enroll immediately
    db.prepare("INSERT OR IGNORE INTO course_enrollments (user_id, course_id) VALUES (?,?)").run(req.user.id, c.id);
    persistNow();
    return res.json({ owned: true, free: true });
  }
  const pay = await requestPayment({
    amount: price, description: `Course #${c.id}`, callbackUrl: `${publicBaseUrl(req)}/api/store/callback`,
    email: req.user.email || "", mobile: "",
  });
  if (!pay.ok) return res.status(502).json({ error: pay.error || "gateway error" });
  db.prepare(`INSERT INTO transactions (user_id, plan, amount, authority, status, gateway)
    VALUES (?,?,?,?, 'pending', ?)`).run(req.user.id, `course:${c.id}`, price, pay.authority, pay.gateway);
  persistNow();
  res.json({ url: pay.url, authority: pay.authority, gateway: pay.gateway });
});

// gateway callback for course purchases -> verify + enroll
r.get("/callback", async (req, res) => {
  const authority = req.query.Authority || req.query.authority;
  const status = req.query.Status || req.query.status;
  const tx = authority ? db.prepare("SELECT * FROM transactions WHERE authority=?").get(authority) : null;
  const back = (r2) => res.redirect(`/?buy=${r2}`);
  if (!tx || !String(tx.plan).startsWith("course:")) return back("notfound");
  if (tx.status === "paid") {
    fulfillCoursePurchase(tx, { refId: tx.ref_id }); // heal a paid-but-not-enrolled crash
    return back("success");
  }
  if (status && String(status).toUpperCase() !== "OK") {
    db.prepare("UPDATE transactions SET status='canceled' WHERE id=? AND status='pending'").run(tx.id);
    persistNow();
    return back("canceled");
  }
  const v = await verifyPayment({ amount: tx.amount, authority });
  if (!v.ok) {
    if (!v.transient) {
      db.prepare("UPDATE transactions SET status='failed' WHERE id=? AND status='pending'").run(tx.id);
      persistNow();
    }
    return back("failed");
  }
  fulfillCoursePurchase(tx, { refId: v.refId });
  return back("success");
});

// courses the current user owns
r.get("/my", authRequired, (req, res) => {
  const lang = L(req);
  const rows = db.prepare(`SELECT c.* FROM course_enrollments e JOIN courses c ON c.id=e.course_id
    WHERE e.user_id=? ORDER BY e.id DESC`).all(req.user.id);
  res.json({ courses: rows.map((c) => ({ id: c.id, title: lang === "fa" ? c.title_fa : c.title_en, cover: c.cover })) });
});

/* ---------------- ADMIN management ---------------- */
r.get("/admin/courses", ...adminContent, (req, res) => {
  const rows = db.prepare("SELECT * FROM courses ORDER BY ord, id DESC").all();
  res.json({ courses: rows.map((c) => {
    const l = db.prepare("SELECT COUNT(*) n, SUM(free_preview) f FROM course_lessons WHERE course_id=?").get(c.id);
    const e = db.prepare("SELECT COUNT(*) n FROM course_enrollments WHERE course_id=?").get(c.id).n;
    return { ...c, lessonCount: l.n || 0, freeCount: l.f || 0, enrolled: e };
  }) });
});
r.get("/admin/courses/:id", ...adminContent, (req, res) => {
  const c = db.prepare("SELECT * FROM courses WHERE id=?").get(req.params.id);
  if (!c) return res.status(404).json({ error: "not found" });
  const lessons = db.prepare("SELECT * FROM course_lessons WHERE course_id=? ORDER BY ord, id").all(c.id);
  res.json({ course: c, lessons });
});
r.post("/admin/courses", ...adminContent, (req, res) => {
  const b = req.body || {};
  const ord = db.prepare("SELECT COALESCE(MAX(ord),-1)+1 n FROM courses").get().n;
  const info = db.prepare(`INSERT INTO courses (title_fa,title_en,desc_fa,desc_en,cover,price,discount_price,instructor_fa,instructor_en,level,published,ord)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    b.title_fa || "", b.title_en || "", b.desc_fa || "", b.desc_en || "", b.cover || "",
    Number(b.price) || 0, b.discount_price === "" || b.discount_price == null ? null : Number(b.discount_price),
    b.instructor_fa || "", b.instructor_en || "", b.level || "all", b.published ? 1 : 0, ord);
  audit(req, "store.course_create", `courses:${info.lastInsertRowid}`, {});
  persistNow();
  res.json({ id: info.lastInsertRowid });
});
r.put("/admin/courses/:id", ...adminContent, (req, res) => {
  const c = db.prepare("SELECT * FROM courses WHERE id=?").get(req.params.id);
  if (!c) return res.status(404).json({ error: "not found" });
  const b = req.body || {};
  db.prepare(`UPDATE courses SET title_fa=?,title_en=?,desc_fa=?,desc_en=?,cover=?,price=?,discount_price=?,
    instructor_fa=?,instructor_en=?,level=?,published=? WHERE id=?`).run(
    b.title_fa ?? c.title_fa, b.title_en ?? c.title_en, b.desc_fa ?? c.desc_fa, b.desc_en ?? c.desc_en,
    b.cover ?? c.cover, b.price != null ? Number(b.price) : c.price,
    b.discount_price === "" ? null : (b.discount_price != null ? Number(b.discount_price) : c.discount_price),
    b.instructor_fa ?? c.instructor_fa, b.instructor_en ?? c.instructor_en, b.level ?? c.level,
    b.published != null ? (b.published ? 1 : 0) : c.published, c.id);
  audit(req, "store.course_edit", `courses:${c.id}`, {});
  persistNow();
  res.json({ ok: true });
});
r.delete("/admin/courses/:id", ...adminContent, (req, res) => {
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM course_lessons WHERE course_id=?").run(req.params.id);
    db.prepare("DELETE FROM course_enrollments WHERE course_id=?").run(req.params.id);
    db.prepare("DELETE FROM courses WHERE id=?").run(req.params.id);
  });
  tx();
  audit(req, "store.course_delete", `courses:${req.params.id}`, {});
  persistNow();
  res.json({ ok: true });
});

// lessons
r.post("/admin/courses/:id/lessons", ...adminContent, (req, res) => {
  const c = db.prepare("SELECT id FROM courses WHERE id=?").get(req.params.id);
  if (!c) return res.status(404).json({ error: "not found" });
  const b = req.body || {};
  const ord = db.prepare("SELECT COALESCE(MAX(ord),-1)+1 n FROM course_lessons WHERE course_id=?").get(c.id).n;
  const info = db.prepare(`INSERT INTO course_lessons (course_id,title_fa,title_en,video_url,duration,free_preview,ord)
    VALUES (?,?,?,?,?,?,?)`).run(c.id, b.title_fa || "", b.title_en || "", b.video_url || "", b.duration || "", b.free_preview ? 1 : 0, ord);
  audit(req, "store.lesson_create", `course_lessons:${info.lastInsertRowid}`, { course: c.id });
  persistNow();
  res.json({ id: info.lastInsertRowid });
});
r.put("/admin/lessons/:id", ...adminContent, (req, res) => {
  const l = db.prepare("SELECT * FROM course_lessons WHERE id=?").get(req.params.id);
  if (!l) return res.status(404).json({ error: "not found" });
  const b = req.body || {};
  db.prepare(`UPDATE course_lessons SET title_fa=?,title_en=?,video_url=?,duration=?,free_preview=? WHERE id=?`).run(
    b.title_fa ?? l.title_fa, b.title_en ?? l.title_en, b.video_url ?? l.video_url,
    b.duration ?? l.duration, b.free_preview != null ? (b.free_preview ? 1 : 0) : l.free_preview, l.id);
  audit(req, "store.lesson_edit", `course_lessons:${l.id}`, {});
  persistNow();
  res.json({ ok: true });
});
r.delete("/admin/lessons/:id", ...adminContent, (req, res) => {
  db.prepare("DELETE FROM course_lessons WHERE id=?").run(req.params.id);
  audit(req, "store.lesson_delete", `course_lessons:${req.params.id}`, {});
  persistNow();
  res.json({ ok: true });
});
// reorder lessons: body { order:[lessonId,...] }
r.put("/admin/courses/:id/reorder", ...adminContent, (req, res) => {
  const order = Array.isArray(req.body?.order) ? req.body.order.map(Number).filter(Boolean) : [];
  const tx = db.transaction(() => order.forEach((lid, i) => db.prepare("UPDATE course_lessons SET ord=? WHERE id=? AND course_id=?").run(i, lid, req.params.id)));
  tx(); persistNow();
  res.json({ ok: true });
});

export default r;
