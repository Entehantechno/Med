/* universities.js — admin management of universities (institutions).
   Teachers & students belong to a university (users.university_id). */
import { Router } from "express";
import crypto from "crypto";
import { db, persistNow } from "../db.js";
import { authRequired, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";
import {
  vpUsage, checkStudentLimit, boolSetting, setSetting, parseLicensingBody,
} from "../lib/orglimits.js";

const r = Router();
const admin = [authRequired, requireRole("admin")];
const genCode = () => "UNI-" + crypto.randomInt(1000, 10000);

// list universities with member counts (admins + teachers see it for assignment)
r.get("/", authRequired, requireRole("admin", "teacher"), (req, res) => {
  let rows = db.prepare("SELECT * FROM universities ORDER BY id DESC").all();
  if (req.user.role === "teacher") {
    const uni = db.prepare("SELECT university_id FROM users WHERE id=?").get(req.user.id)?.university_id;
    rows = rows.filter((u) => u.id === uni);
  }
  res.json({
    universities: rows.map((u) => ({
      ...u,
      teachers: db.prepare("SELECT COUNT(*) c FROM users WHERE role='teacher' AND university_id=?").get(u.id).c,
      students: db.prepare("SELECT COUNT(*) c FROM users WHERE role='student' AND university_id=?").get(u.id).c,
      // Live monthly consumption + the global defaults each university may
      // override — drives the admin meters/toggles without extra requests.
      usage: vpUsage(u.id),
    })),
    defaults: {
      flash_no_penalty: boolSetting("default_flash_no_penalty", false),
      live_board_speed: boolSetting("default_live_board_speed", false),
    },
  });
});

/* Global feature defaults (admin) — the last step of the
   class → university → global inheritance chain. Admin-only, unlike the list
   above which teachers can also read. */
r.get("/defaults", ...admin, (req, res) => {
  res.json({
    flash_no_penalty: boolSetting("default_flash_no_penalty", false),
    live_board_speed: boolSetting("default_live_board_speed", false),
  });
});

r.put("/defaults", ...admin, (req, res) => {
  const b = req.body || {};
  if (b.flash_no_penalty !== undefined) setSetting("default_flash_no_penalty", b.flash_no_penalty ? "1" : "0");
  if (b.live_board_speed !== undefined) setSetting("default_live_board_speed", b.live_board_speed ? "1" : "0");
  audit(req, "university.defaults", "universities", { flash_no_penalty: b.flash_no_penalty, live_board_speed: b.live_board_speed });
  persistNow();
  res.json({ ok: true,
    flash_no_penalty: boolSetting("default_flash_no_penalty", false),
    live_board_speed: boolSetting("default_live_board_speed", false) });
});

r.post("/", ...admin, (req, res) => {
  const b = req.body || {};
  if (!b.name_fa && !b.name_en) return res.status(400).json({ error: "name required" });
  // The licensing/limits panel (plan, sale method, caps, feature flags) was
  // previously ignored on create and the operator lost the data — honour it.
  const lic = parseLicensingBody(b);
  if (lic.error) return res.status(400).json({ error: lic.error });
  let code = (b.code || "").trim() || genCode();
  for (let i = 0; i < 5 && db.prepare("SELECT 1 FROM universities WHERE code=?").get(code); i++) code = genCode();
  const info = db.prepare("INSERT INTO universities (name_fa,name_en,city_fa,city_en,code) VALUES (?,?,?,?,?)")
    .run(b.name_fa || b.name_en, b.name_en || b.name_fa, b.city_fa || "", b.city_en || "", code);
  const id = info.lastInsertRowid;
  for (const [col, val] of Object.entries(lic.patch)) {
    db.prepare(`UPDATE universities SET ${col}=? WHERE id=?`).run(val, id);
  }
  audit(req, "university.create", `universities:${id}`, { name: b.name_fa || b.name_en, licensing: Object.keys(lic.patch) });
  persistNow();
  res.json({ id, code });
});

r.put("/:id", ...admin, (req, res) => {
  const u = db.prepare("SELECT * FROM universities WHERE id=?").get(req.params.id);
  if (!u) return res.status(404).json({ error: "not found" });
  const b = req.body || {};
  const lic = parseLicensingBody(b);
  if (lic.error) return res.status(400).json({ error: lic.error });

  // Enabling / tightening the students cap must never go below what already
  // exists — refuse loudly instead of half-enforcing a licence.
  const nextMax = "max_students" in lic.patch ? lic.patch.max_students : u.max_students;
  const nextEnabled = "limits_enabled" in lic.patch ? lic.patch.limits_enabled : u.limits_enabled;
  if (nextEnabled && nextMax != null) {
    const cur = db.prepare("SELECT COUNT(*) c FROM users WHERE role='student' AND university_id=?").get(u.id).c;
    if (nextMax < cur) return res.status(409).json({ error: "cap_below_current_students", current: cur, requested: nextMax });
  }

  db.prepare("UPDATE universities SET name_fa=?, name_en=?, city_fa=?, city_en=?, active=? WHERE id=?")
    .run(b.name_fa ?? u.name_fa, b.name_en ?? u.name_en, b.city_fa ?? u.city_fa, b.city_en ?? u.city_en,
      b.active === 0 ? 0 : 1, u.id);
  for (const [col, val] of Object.entries(lic.patch)) {
    db.prepare(`UPDATE universities SET ${col}=? WHERE id=?`).run(val, u.id);
  }
  audit(req, "university.update", `universities:${u.id}`, { licensing: Object.keys(lic.patch) });
  persistNow();
  res.json({ ok: true });
});

/* Members of one university — teachers first, then students. Lets the admin
   see & manage the faculty that belong to a university (teachers ⊂ university). */
r.get("/:id/members", authRequired, requireRole("admin", "teacher"), (req, res) => {
  if (req.user.role === "teacher") {
    const uni = db.prepare("SELECT university_id FROM users WHERE id=?").get(req.user.id)?.university_id;
    if (Number(req.params.id) !== Number(uni)) return res.status(403).json({ error: "wrong_university", stage: "access" });
  }
  const lang = req.query.lang === "en" ? "en" : "fa";
  const rows = db.prepare(`SELECT id, name_fa, name_en, username, email, role, status, student_no
    FROM users WHERE university_id=? AND role IN ('teacher','student')
    ORDER BY CASE role WHEN 'teacher' THEN 0 ELSE 1 END, name_fa`).all(req.params.id);
  res.json({
    teachers: rows.filter((u) => u.role === "teacher").map((u) => ({ id: u.id, name: lang === "fa" ? (u.name_fa || u.name_en) : (u.name_en || u.name_fa), email: u.email, status: u.status })),
    students: rows.filter((u) => u.role === "student").map((u) => ({ id: u.id, name: lang === "fa" ? (u.name_fa || u.name_en) : (u.name_en || u.name_fa), student_no: u.student_no, status: u.status })),
  });
});

/* Add EXISTING teachers/students to this university (bulk). Admin assigns
   faculty & learners to an institution without them re-registering. */
r.post("/:id/members", ...admin, (req, res) => {
  const uni = db.prepare("SELECT id FROM universities WHERE id=?").get(req.params.id);
  if (!uni) return res.status(404).json({ error: "not found" });
  const ids = Array.isArray(req.body?.userIds) ? req.body.userIds.map((x) => parseInt(x, 10)).filter(Boolean) : [];
  if (!ids.length) return res.status(400).json({ error: "no users" });
  // License enforcement: newly arriving students count against the cap.
  const ph = ids.map(() => "?").join(",");
  const newcomers = db.prepare(
    `SELECT COUNT(*) c FROM users WHERE id IN (${ph}) AND role='student' AND (university_id IS NULL OR university_id<>?)`
  ).get(...ids, uni.id).c;
  const hit = checkStudentLimit(uni.id, newcomers);
  if (hit) {
    return res.status(403).json({
      error: "university_student_limit", ...hit,
      message_fa: `سقف دانشجویان این دانشگاه (${hit.max}) تکمیل است؛ افزودن ${newcomers} دانشجو ممکن نیست.`,
    });
  }
  let moved = 0;
  const upd = db.prepare("UPDATE users SET university_id=? WHERE id=? AND role IN ('teacher','student')");
  const tx = db.transaction(() => { for (const id of ids) { const r2 = upd.run(uni.id, id); moved += r2.changes || 0; } });
  tx();
  audit(req, "university.add_members", `universities:${uni.id}`, { count: moved });
  persistNow();
  res.json({ ok: true, moved });
});

// Remove a member from this university (detach; the user stays but unassigned).
r.delete("/:id/members/:userId", ...admin, (req, res) => {
  const r2 = db.prepare("UPDATE users SET university_id=NULL WHERE id=? AND university_id=?").run(req.params.userId, req.params.id);
  audit(req, "university.remove_member", `universities:${req.params.id}`, { user: req.params.userId });
  persistNow();
  res.json({ ok: true, removed: r2.changes || 0 });
});

// Candidate users (teachers/students) not yet in ANY university (or in another),
// so the admin can pick who to add. Optional ?q= name/username search.
r.get("/:id/candidates", ...admin, (req, res) => {
  const lang = req.query.lang === "en" ? "en" : "fa";
  const q = `%${String(req.query.q || "").trim()}%`;
  const rows = db.prepare(`SELECT id, name_fa, name_en, username, role, student_no, university_id
    FROM users WHERE role IN ('teacher','student') AND (university_id IS NULL OR university_id<>?)
    AND (name_fa LIKE ? OR name_en LIKE ? OR username LIKE ? OR student_no LIKE ?)
    ORDER BY role, name_fa LIMIT 200`).all(req.params.id, q, q, q, q);
  res.json({ candidates: rows.map((u) => ({ id: u.id, name: lang === "fa" ? (u.name_fa || u.name_en) : (u.name_en || u.name_fa), role: u.role, student_no: u.student_no, hasUni: !!u.university_id })) });
});

r.delete("/:id", ...admin, (req, res) => {
  const u = db.prepare("SELECT * FROM universities WHERE id=?").get(req.params.id);
  if (!u) return res.status(404).json({ error: "not found" });
  const members = db.prepare("SELECT COUNT(*) c FROM users WHERE university_id=?").get(u.id).c;
  if (members > 0) return res.status(400).json({ error: "university has members", members });
  db.prepare("DELETE FROM universities WHERE id=?").run(u.id);
  audit(req, "university.delete", `universities:${u.id}`, { name: u.name_fa });
  persistNow();
  res.json({ ok: true });
});

export default r;
