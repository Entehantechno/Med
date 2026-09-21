import express from "express";
import { db, persistNow } from "../db.js";
import { authRequired, requireRole } from "../lib/auth.js";

const r = express.Router();
const admin = [authRequired, requireRole("admin", "teacher", "content_manager")];
const settings = () => db.prepare("SELECT * FROM tutor_settings WHERE id=1").get() || { enabled: 0, ai_enabled: 0, default_prompt: "" };
const isEnabledFor = (ct = "general", cid = null) => {
  let en = !!settings().enabled;
  cid = Number(cid || 0) || null;
  if (ct === "class" && cid) en = en || !!db.prepare("SELECT tutor_enabled FROM classes WHERE id=?").get(cid)?.tutor_enabled;
  if (ct === "exam" && cid) en = en || !!db.prepare("SELECT tutor_enabled FROM exams WHERE id=?").get(cid)?.tutor_enabled;
  return en;
};
const reply = (m, l) => l === "en"
  ? `Dr Tutor: I can guide your reasoning. Compare close options. Your question: "${String(m).slice(0, 160)}"`
  : `دکتر راهنما: جواب نهایی آزمون را مستقیم لو نمی‌دهم، اما مسیر فکر کردن را راهنمایی می‌کنم. سؤال تو: «${String(m).slice(0, 160)}»`;

function studentBelongsToClass(uid, cid) {
  return !!db.prepare("SELECT 1 FROM class_members WHERE class_id=? AND user_id=?").get(cid, uid);
}
function studentBelongsToExam(uid, eid) {
  return !!db.prepare("SELECT 1 FROM exam_participants WHERE exam_id=? AND user_id=?").get(eid, uid);
}
/* University class/exam tutor is for enrolled students only. Learners stay on general/learn. */
function tutorContextDenied(user, ct, cid) {
  if (ct !== "class" && ct !== "exam") return null;
  if (user.role === "learner") return { status: 403, error: "university_only", stage: "access" };
  if (user.role !== "student") return { status: 403, error: "forbidden", stage: "access" };
  if (!cid) return { status: 403, error: ct === "class" ? "not enrolled" : "not assigned", stage: "access" };
  if (ct === "class" && !studentBelongsToClass(user.id, cid)) {
    return { status: 403, error: "not enrolled", stage: "access" };
  }
  if (ct === "exam" && !studentBelongsToExam(user.id, cid)) {
    return { status: 403, error: "not assigned", stage: "access" };
  }
  return null;
}

function currentUniversityId(user) {
  return db.prepare("SELECT university_id FROM users WHERE id=?").get(user.id)?.university_id || null;
}
function refuseCm(req, res) {
  if (req.user.role === "content_manager") {
    res.status(403).json({ error: "university_only", stage: "access" });
    return true;
  }
  return false;
}
r.get("/settings", ...admin, (req, res) => {
  if (refuseCm(req, res)) return;
  res.json(settings());
});
r.put("/settings", ...admin, (req, res) => {
  if (refuseCm(req, res)) return;
  const b = req.body || {};
  db.prepare("UPDATE tutor_settings SET enabled=?,ai_enabled=?,default_prompt=?,updated_at=datetime('now') WHERE id=1")
    .run(b.enabled ? 1 : 0, b.ai_enabled ? 1 : 0, b.default_prompt || "");
  persistNow();
  res.json(settings());
});
r.get("/context-settings", ...admin, (req, res) => {
  if (refuseCm(req, res)) return;
  const uni = req.user.role === "teacher" ? (currentUniversityId(req.user) || -1) : null;
  const classes = uni
    ? db.prepare("SELECT id,name_fa,name_en,tutor_enabled,tutor_prompt FROM classes WHERE university_id=? ORDER BY id DESC LIMIT 200").all(uni)
    : db.prepare("SELECT id,name_fa,name_en,tutor_enabled,tutor_prompt FROM classes ORDER BY id DESC LIMIT 200").all();
  const exams = uni
    ? db.prepare("SELECT id,title_fa,title_en,tutor_enabled,tutor_prompt FROM exams WHERE university_id=? ORDER BY id DESC LIMIT 200").all(uni)
    : db.prepare("SELECT id,title_fa,title_en,tutor_enabled,tutor_prompt FROM exams ORDER BY id DESC LIMIT 200").all();
  res.json({ classes, exams });
});
r.put("/context-settings", ...admin, (req, res) => {
  if (refuseCm(req, res)) return;
  const b = req.body || {}, id = Number(b.contextId || 0);
  if (!id) return res.status(400).json({ error: "bad_id" });
  if (req.user.role === "teacher") {
    const uni = currentUniversityId(req.user) || -1;
    if (b.contextType === "class") {
      const cl = db.prepare("SELECT university_id FROM classes WHERE id=?").get(id);
      if (!cl || cl.university_id !== uni) return res.status(403).json({ error: "wrong_university", stage: "access" });
    } else if (b.contextType === "exam") {
      const ex = db.prepare("SELECT university_id FROM exams WHERE id=?").get(id);
      if (!ex || ex.university_id !== uni) return res.status(403).json({ error: "wrong_university", stage: "access" });
    }
  }
  if (b.contextType === "class") db.prepare("UPDATE classes SET tutor_enabled=?,tutor_prompt=? WHERE id=?").run(b.enabled ? 1 : 0, b.prompt || "", id);
  else if (b.contextType === "exam") db.prepare("UPDATE exams SET tutor_enabled=?,tutor_prompt=? WHERE id=?").run(b.enabled ? 1 : 0, b.prompt || "", id);
  else return res.status(400).json({ error: "bad_context" });
  persistNow();
  res.json({ ok: true });
});
r.get("/status", authRequired, (req, res) => {
  const ct = req.query.contextType || "general";
  const cid = Number(req.query.contextId || 0) || null;
  const denied = tutorContextDenied(req.user, ct, cid);
  if (denied) return res.status(denied.status).json({ error: denied.error, stage: denied.stage });
  res.json({ enabled: isEnabledFor(ct, cid) });
});
r.get("/history", authRequired, (req, res) => {
  const ct = req.query.contextType || "general", cid = Number(req.query.contextId || 0) || null;
  const denied = tutorContextDenied(req.user, ct, cid);
  if (denied) return res.status(denied.status).json({ error: denied.error, stage: denied.stage });
  if (!isEnabledFor(ct, cid)) return res.status(403).json({ error: "tutor_disabled" });
  res.json({
    messages: db.prepare("SELECT role,message,created_at FROM tutor_chats WHERE user_id=? AND context_type=? AND COALESCE(context_id,0)=COALESCE(?,0) ORDER BY id DESC LIMIT 80")
      .all(req.user.id, ct, cid).reverse(),
  });
});
r.post("/message", authRequired, (req, res) => {
  const b = req.body || {}, ct = b.contextType || "general", cid = Number(b.contextId || 0) || null;
  const denied = tutorContextDenied(req.user, ct, cid);
  if (denied) return res.status(denied.status).json({ error: denied.error, stage: denied.stage });
  if (!isEnabledFor(ct, cid)) return res.status(403).json({ error: "tutor_disabled" });
  const msg = String(b.message || "").trim().slice(0, 2000);
  if (!msg) return res.status(400).json({ error: "empty" });
  db.prepare("INSERT INTO tutor_chats (user_id,context_type,context_id,role,message) VALUES (?,?,?,?,?)").run(req.user.id, ct, cid, "user", msg);
  const out = reply(msg, b.lang === "en" ? "en" : "fa");
  db.prepare("INSERT INTO tutor_chats (user_id,context_type,context_id,role,message,meta_json) VALUES (?,?,?,?,?,?)")
    .run(req.user.id, ct, cid, "tutor", out, JSON.stringify({ ai: false }));
  persistNow();
  res.json({ reply: out });
});
export default r;
