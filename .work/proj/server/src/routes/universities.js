import {normDigits} from '../lib/textsearch.js';
/* universities.js — admin management of universities (institutions).
   Teachers & students belong to a university (users.university_id). */
import { Router } from "express";
import crypto from "crypto";
import { db, durableTransaction } from "../db.js";
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
  let rows = db.prepare("SELECT * FROM universities WHERE retired_at IS NULL ORDER BY id DESC").all();
  if (req.user.role === "teacher") {
    const uni = db.prepare("SELECT university_id FROM users WHERE id=?").get(req.user.id)?.university_id;
    rows = rows.filter((u) => u.id === uni);
  }
  const lang = req.query.lang === 'en' ? 'en' : 'fa';
  const collator = new Intl.Collator(lang, {sensitivity:'base',numeric:true});
  const label = u => (lang === 'fa' ? u.name_fa : u.name_en) || u.name_fa || u.name_en || u.code || '';
  rows.sort((a,b)=>collator.compare(label(a),label(b)) || a.id-b.id);
  // Aggregate membership once instead of two extra queries per university.
  const counts = new Map();
  if (rows.length) {
    const allowed = new Set(rows.map(u=>u.id));
    for (const row of db.prepare("SELECT university_id, role, COUNT(*) n FROM users WHERE role IN ('teacher','student') GROUP BY university_id,role").all()) {
      if (allowed.has(row.university_id)) counts.set(`${row.university_id}:${row.role}`,row.n);
    }
  }
  res.json({
    universities: rows.map((u) => ({
      ...u,
      teachers: counts.get(`${u.id}:teacher`) || 0,
      students: counts.get(`${u.id}:student`) || 0,
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
  durableTransaction(() => {
  if (b.flash_no_penalty !== undefined) setSetting("default_flash_no_penalty", b.flash_no_penalty ? "1" : "0");
  if (b.live_board_speed !== undefined) setSetting("default_live_board_speed", b.live_board_speed ? "1" : "0");
  });
  audit(req, "university.defaults", "universities", { flash_no_penalty: b.flash_no_penalty, live_board_speed: b.live_board_speed });
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
  const id = durableTransaction(() => {
  const info = db.prepare("INSERT INTO universities (name_fa,name_en,city_fa,city_en,code) VALUES (?,?,?,?,?)")
    .run(b.name_fa || b.name_en, b.name_en || b.name_fa, b.city_fa || "", b.city_en || "", code);
  const id = info.lastInsertRowid;
  for (const [col, val] of Object.entries(lic.patch)) {
    db.prepare(`UPDATE universities SET ${col}=? WHERE id=?`).run(val, id);
  }
  return id;
  });
  audit(req, "university.create", `universities:${id}`, { name: b.name_fa || b.name_en, licensing: Object.keys(lic.patch) });
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

  durableTransaction(() => {
  db.prepare("UPDATE universities SET name_fa=?, name_en=?, city_fa=?, city_en=?, active=? WHERE id=?")
    .run(b.name_fa ?? u.name_fa, b.name_en ?? u.name_en, b.city_fa ?? u.city_fa, b.city_en ?? u.city_en,
      b.active === undefined ? u.active : (b.active === 0 || b.active === false ? 0 : 1), u.id);
  for (const [col, val] of Object.entries(lic.patch)) {
    db.prepare(`UPDATE universities SET ${col}=? WHERE id=?`).run(val, u.id);
  }
  });
  audit(req, "university.update", `universities:${u.id}`, { licensing: Object.keys(lic.patch) });
  res.json({ ok: true });
});

/* Members of one university — teachers first, then students. Lets the admin
   see & manage the faculty that belong to a university (teachers ⊂ university). */
r.get("/:id/members", authRequired, requireRole("admin", "teacher"), (req, res) => {
  if (req.user.role === "teacher") {
    const uni = db.prepare("SELECT university_id FROM users WHERE id=?").get(req.user.id)?.university_id;
    if (Number(req.params.id) !== Number(uni)) return res.status(403).json({ error: "wrong_university", stage: "access" });
  }
  if (!db.prepare('SELECT id FROM universities WHERE id=?').get(req.params.id)) return res.status(404).json({error:'not_found'});
  const lang = req.query.lang === 'en' ? 'en' : 'fa';
  const pageInput = Number(req.query.page ?? 1), sizeInput = Number(req.query.pageSize ?? 50);
  if (!Number.isSafeInteger(pageInput) || pageInput < 1 || !Number.isSafeInteger(sizeInput) || sizeInput < 1) return res.status(400).json({error:'invalid_pagination'});
  const pageSize = Math.min(100, sizeInput);
  const role = String(req.query.role || ''), status = String(req.query.status || '');
  if ((role && !['teacher','student'].includes(role)) || (status && !['active','inactive','pending'].includes(status))) return res.status(400).json({error:'invalid_filter'});
  let where = "WHERE university_id=? AND role IN ('teacher','student')";
  const args = [req.params.id];
  const q = normDigits(String(req.query.q || '').trim()).slice(0,200).toLowerCase();
  if (q) { where += " AND (instr(lower(COALESCE(name_fa,'')),?)>0 OR instr(lower(COALESCE(name_en,'')),?)>0 OR instr(lower(username),?)>0 OR instr(lower(COALESCE(student_no,'')),?)>0 OR instr(lower(COALESCE(email,'')),?)>0)"; args.push(q,q,q,q,q); }
  const prefix = normDigits(String(req.query.prefix || '').trim()).slice(0,200);
  if (prefix) { where += " AND instr(COALESCE(student_no,''),?)=1"; args.push(prefix); }
  if (role) { where += ' AND role=?'; args.push(role); }
  if (status) { where += ' AND status=?'; args.push(status); }
  const total = db.prepare('SELECT COUNT(*) n FROM users '+where).get(...args).n;
  const page = Math.min(pageInput, Math.max(1,Math.ceil(total/pageSize)));
  const nameExpr = lang === 'en' ? "COALESCE(NULLIF(name_en,''),NULLIF(name_fa,''),username)" : "COALESCE(NULLIF(name_fa,''),NULLIF(name_en,''),username)";
  const sorts = { name: nameExpr+' COLLATE NOCASE', student_no: "COALESCE(student_no,'') COLLATE NOCASE", role: "CASE role WHEN 'teacher' THEN 0 ELSE 1 END", id: 'id' };
  const sort = Object.hasOwn(sorts, req.query.sort) ? sorts[req.query.sort] : sorts.role;
  const rows = db.prepare(`SELECT id, ${nameExpr} name, username, email, role, status, student_no FROM users ${where} ORDER BY ${sort},id LIMIT ? OFFSET ?`).all(...args,pageSize,(page-1)*pageSize);
  // Legacy field names remain, but contain only this page. Never fetch all users.
  res.json({ items: rows, total, page, pageSize,
    teachers: rows.filter(u=>u.role==='teacher'), students: rows.filter(u=>u.role==='student') });
});

/* Add EXISTING teachers/students to this university (bulk). Admin assigns
   faculty & learners to an institution without them re-registering. */
r.post("/:id/members", ...admin, (req, res) => {
  const uni = db.prepare("SELECT id FROM universities WHERE id=?").get(req.params.id);
  if (!uni) return res.status(404).json({ error: "not found" });
  const raw=req.body?.userIds;
  if(!Array.isArray(raw)||raw.length>10000||raw.some(n=>!['string','number'].includes(typeof n)||!Number.isSafeInteger(Number(n))||Number(n)<=0))return res.status(400).json({error:'invalid_user_ids'});
  const ids=[...new Set(raw.map(Number))];
  if (!ids.length) return res.status(400).json({ error: "no users" });
  // License enforcement: newly arriving students count against the cap.
  const rows=[];
  for(let i=0;i<ids.length;i+=400){const part=ids.slice(i,i+400);rows.push(...db.prepare(`SELECT id,role,university_id FROM users WHERE id IN (${part.map(()=>'?').join(',')})`).all(...part));}
  if(rows.length!==ids.length||rows.some(u=>!['student','teacher'].includes(u.role)))return res.status(422).json({error:'invalid_university_members'});
  const newcomers=rows.filter(u=>u.role==='student'&&Number(u.university_id)!==Number(uni.id)).length;
  const hit = checkStudentLimit(uni.id, newcomers);
  if (hit) {
    return res.status(403).json({
      error: "university_student_limit", ...hit,
      message_fa: `سقف دانشجویان این دانشگاه (${hit.max}) تکمیل است؛ افزودن ${newcomers} دانشجو ممکن نیست.`,
    });
  }
  let moved = 0;
  const upd = db.prepare("UPDATE users SET university_id=? WHERE id=? AND role IN ('teacher','student')");
  durableTransaction(() => { for (const id of new Set(ids)) { const r2 = upd.run(uni.id, id); moved += r2.changes || 0; } });
  audit(req, "university.add_members", `universities:${uni.id}`, { count: moved });
  res.json({ ok: true, moved });
});

// Remove a member from this university (detach; the user stays but unassigned).
r.delete("/:id/members/:userId", ...admin, (req, res) => {
  const r2 = durableTransaction(() => db.prepare("UPDATE users SET university_id=NULL WHERE id=? AND university_id=?").run(req.params.userId, req.params.id));
  audit(req, "university.remove_member", `universities:${req.params.id}`, { user: req.params.userId });
  res.json({ ok: true, removed: r2.changes || 0 });
});

// Candidate users (teachers/students) not yet in ANY university (or in another),
// so the admin can pick who to add. Optional ?q= name/username search.
r.get("/:id/candidates", ...admin, (req, res) => {
  if(!db.prepare('SELECT id FROM universities WHERE id=?').get(req.params.id))return res.status(404).json({error:'not_found'});
  const lang=req.query.lang==='en'?'en':'fa',q='%'+normDigits(String(req.query.q||'').trim()).slice(0,200)+'%';
  let where="WHERE u.role IN ('teacher','student') AND (u.university_id IS NULL OR u.university_id<>?) AND (u.name_fa LIKE ? OR u.name_en LIKE ? OR u.username LIKE ? OR u.student_no LIKE ?)";
  const args=[req.params.id,q,q,q,q];
  if(['teacher','student'].includes(req.query.role)){where+=' AND u.role=?';args.push(req.query.role);}
  if(req.query.prefix){where+=' AND u.student_no LIKE ?';args.push(normDigits(String(req.query.prefix)).replace(/[%_]/g,'')+'%');}
  const total=db.prepare('SELECT COUNT(*) n FROM users u '+where).get(...args).n;
  const page=Math.max(1,Math.floor(Number(req.query.page)||1)),pageSize=Math.max(1,Math.min(200,Math.floor(Number(req.query.pageSize)||50)));
  const rows=db.prepare(`SELECT u.id,u.name_fa,u.name_en,u.username,u.role,u.student_no,u.university_id,uni.name_fa uni_fa,uni.name_en uni_en FROM users u LEFT JOIN universities uni ON uni.id=u.university_id ${where} ORDER BY u.student_no COLLATE NOCASE,u.id LIMIT ? OFFSET ?`).all(...args,pageSize,(page-1)*pageSize);
  res.json({total,page,pageSize,candidates:rows.map(u=>({id:u.id,name:(lang==='fa'?u.name_fa:u.name_en)||u.name_en||u.name_fa||u.username,role:u.role,student_no:u.student_no,hasUni:!!u.university_id,university_name:(lang==='fa'?u.uni_fa:u.uni_en)||u.university_id}))});
});

r.delete("/:id", ...admin, (req, res) => {
  const u = db.prepare("SELECT * FROM universities WHERE id=?").get(req.params.id);
  if (!u) return res.status(404).json({ error: "not found" });
  const members = db.prepare("SELECT COUNT(*) c FROM users WHERE university_id=?").get(u.id).c;
  if (members > 0) return res.status(400).json({ error: "university has members", members });
  durableTransaction(() => db.prepare("DELETE FROM universities WHERE id=?").run(u.id));
  audit(req, "university.delete", `universities:${u.id}`, { name: u.name_fa });
  res.json({ ok: true });
});

export default r;
