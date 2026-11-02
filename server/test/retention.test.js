/* R83 data retention: nothing is deleted unless an admin sets a period; a purge
   removes the chat text and the event log of finished, graded virtual-patient
   encounters and keeps the grade; unfinished, ungraded, study-linked and
   in-review encounters are never touched; class and exam periods override the
   global one; enabling needs confirmation; audit rows carry counts only. */
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import request from "supertest";
import { initDb, db } from "../src/db.js";
import { createApp } from "../src/app.js";
import { readPolicy, savePolicy, previewPurge, runAutomaticRetention, purgeCategory, compactDatabase, storageInfo, blockReason } from "../src/lib/retention.js";

let app, admin, teacher, learner, caseId;
const login = (u, p = "demo") => request(app).post("/api/auth/login").send({ username: u, password: p });
const A = (tk) => ({ Authorization: `Bearer ${tk}` });
const MARK = "PRIVATE-CHAT-TEXT-r83";

const oldSession = ({ days = 400, classId = null, examId = null, studyId = null, finished = true, review = 0, transcript = true } = {}) => {
  const attemptId = finished && !review
    ? db.prepare(`INSERT INTO attempts (user_id,type,case_id,class_id,exam_id,score,transcript_json,eval_json,created_at)
        VALUES (?, 'vp', ?, ?, ?, 77, ?, '{"ok":true}', datetime('now', ?))`)
      .run(learner.id, caseId, classId, examId, transcript ? `{"messages":"${MARK}"}` : null, `-${days} days`).lastInsertRowid
    : null;
  const sid = db.prepare(`INSERT INTO vp_sessions (user_id,case_id,class_id,exam_id,study_id,logging_enabled,started_at,started_ms,
      finished_at,attempt_id,progress_json,encounter_snapshot_json,grading_draft_json,review_required)
    VALUES (?,?,?,?,?,1,datetime('now', ?),0,${finished ? "datetime('now', ?)" : "NULL"},?,?,?,?,?)`)
    .run(...[learner.id, caseId, classId, examId, studyId, `-${days + 1} days`, ...(finished ? [`-${days} days`] : []),
      attemptId, `{"messages":"${MARK}"}`, `{"case":"${MARK}"}`, `{"draft":"${MARK}"}`, review]).lastInsertRowid;
  db.prepare("INSERT INTO vp_session_events (session_id,seq,at_ms,kind,payload_json) VALUES (?,1,1,'student_msg',?)").run(sid, `{"text":"${MARK}"}`);
  return { sid, attemptId };
}
const sessionRow = (sid) => db.prepare("SELECT * FROM vp_sessions WHERE id=?").get(sid);
const eventCount = (sid) => db.prepare("SELECT COUNT(*) n FROM vp_session_events WHERE session_id=?").get(sid).n;
const attemptRow = (id) => db.prepare("SELECT * FROM attempts WHERE id=?").get(id);
const newClass = (tag, retention = null) => db.prepare(`INSERT INTO classes(name_en,name_fa,code,owner_id,university_id,max_attempts,log_transcript,retention_days)
  VALUES (?,?,?,?,?,100,1,?)`).run(`Ret ${tag}`, `ret ${tag}`, `ret-${tag}-${Date.now()}`, teacher.id, teacher.university_id, retention).lastInsertRowid;

beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb();
  app = createApp();
  admin = (await login("admin")).body;
  teacher = db.prepare("SELECT * FROM users WHERE username='teacher'").get();
  learner = db.prepare("SELECT * FROM users WHERE username='40012345'").get();
  caseId = db.prepare("SELECT id FROM cases ORDER BY id LIMIT 1").get().id;
  admin.token = admin.token || (await login("admin")).body.token;
});

describe("defaults and policy", () => {
  it("keeps every chat and log until an admin sets a period (rum keeps its 45 days)", () => {
    const p = readPolicy();
    expect(p).toEqual({ vp_chats: 0, academic_items: 0, tutor_chats: 0, security_events: 0, rum_vitals: 45 });
  });

  it("refuses to enable a category without confirmation (409), and accepts it with confirmation", async () => {
    const tk = admin.token;
    const bad = await request(app).put("/api/admin/retention").set(A(tk)).send({ policy: { vp_chats: 365 } });
    expect(bad.status).toBe(409);
    expect(bad.body.error).toBe("confirmation_required");
    expect(readPolicy().vp_chats).toBe(0);
    const ok = await request(app).put("/api/admin/retention").set(A(tk)).send({ policy: { vp_chats: 365 }, confirm: true });
    expect(ok.status).toBe(200);
    expect(readPolicy().vp_chats).toBe(365);
    // Changing an already-enabled period needs no second confirmation.
    const same = await request(app).put("/api/admin/retention").set(A(tk)).send({ policy: { vp_chats: 180 } });
    expect(same.status).toBe(200);
    expect(readPolicy().vp_chats).toBe(180);
    await request(app).put("/api/admin/retention").set(A(tk)).send({ policy: { vp_chats: 0 } });
  });

  it("rejects periods below 30 days and non-integers", () => {
    expect(savePolicy({ tutor_chats: 5 }, { confirmed: true }).error).toBe("retention_days_range");
    expect(savePolicy({ tutor_chats: 30.5 }, { confirmed: true }).error).toBe("retention_days_range");
  });
});

describe("VP chat purge", () => {
  it("removes chat text and events of an old finished encounter, keeps the grade and the evaluation", async () => {
    const old = oldSession({ days: 400 });
    const unfinished = oldSession({ days: 400, finished: false });
    const studyLinked = oldSession({ days: 400, studyId: 9001 });
    const inReview = oldSession({ days: 400, review: 1 });
    const recent = oldSession({ days: 10 });
    await request(app).put("/api/admin/retention").set(A(admin.token)).send({ policy: { vp_chats: 365 }, confirm: true });
    const counts = await runAutomaticRetention();
    expect(counts.vp_chats.sessions).toBeGreaterThanOrEqual(1);
    const s = sessionRow(old.sid);
    expect(s.purged_ms).toBeTruthy();
    expect(s.progress_json).toBeNull();
    expect(s.encounter_snapshot_json).toBeNull();
    expect(s.grading_draft_json).toBeNull();
    expect(eventCount(old.sid)).toBe(0);
    const a = attemptRow(old.attemptId);
    expect(a.transcript_json).toBeNull();
    expect(a.score).toBe(77);
    expect(a.eval_json).toBe('{"ok":true}');
    // Never touched: unfinished, study-linked, in review, recent.
    for (const x of [unfinished, studyLinked, inReview, recent]) {
      expect(sessionRow(x.sid).purged_ms).toBeNull();
      expect(eventCount(x.sid)).toBe(1);
    }
    await request(app).put("/api/admin/retention").set(A(admin.token)).send({ policy: { vp_chats: 0 } });
  });

  it("a class period overrides the global one: 0 keeps forever, 30 purges even when the global period is off", async () => {
    const keepClass = newClass("keep", 0);
    const shortClass = newClass("short", 30);
    const keep = oldSession({ days: 400, classId: keepClass });
    const short = oldSession({ days: 40, classId: shortClass });
    const inherit = oldSession({ days: 400, classId: newClass("inherit", null) });
    expect(readPolicy().vp_chats).toBe(0);
    await runAutomaticRetention();
    expect(sessionRow(keep.sid).purged_ms).toBeNull();
    expect(sessionRow(short.sid).purged_ms).toBeTruthy();
    expect(sessionRow(inherit.sid).purged_ms).toBeNull();
  });

  it("previews count exactly what the purge then removes", async () => {
    const cls = newClass("preview", 30);
    oldSession({ days: 60, classId: cls });
    oldSession({ days: 60, classId: cls });
    const preview = previewPurge("vp_chats", 0);
    expect(preview.sessions).toBeGreaterThanOrEqual(2);
    const done = await purgeCategory("vp_chats", 0);
    expect(done.sessions).toBe(preview.sessions);
    expect(previewPurge("vp_chats", 0).sessions).toBe(0);
  });

  it("manual purge of chosen encounters: teachers are refused, admins need confirmation, non-VP attempts are never touched", async () => {
    const pick = oldSession({ days: 5 });
    const examAttempt = db.prepare(`INSERT INTO attempts (user_id,type,case_id,score,transcript_json,created_at)
      VALUES (?, 'exam', ?, 50, '{"answers":[1]}', datetime('now','-400 days'))`).run(learner.id, caseId).lastInsertRowid;
    const teacherTk = (await login("teacher")).body.token;
    const denied = await request(app).post("/api/admin/retention/vp-chats/delete").set(A(teacherTk))
      .send({ attemptIds: [pick.attemptId], confirm: true });
    expect([401, 403]).toContain(denied.status);
    const noConfirm = await request(app).post("/api/admin/retention/vp-chats/delete").set(A(admin.token))
      .send({ attemptIds: [pick.attemptId] });
    expect(noConfirm.status).toBe(409);
    const done = await request(app).post("/api/admin/retention/vp-chats/delete").set(A(admin.token))
      .send({ attemptIds: [pick.attemptId, examAttempt], confirm: true });
    expect(done.status).toBe(200);
    expect(done.body.sessions).toBe(1);
    expect(attemptRow(pick.attemptId).transcript_json).toBeNull();
    expect(attemptRow(examAttempt).transcript_json).toBe('{"answers":[1]}');
  });
});

describe("tutor chats and security events", () => {
  it("are deleted only when their own period is set, and by age", async () => {
    db.prepare("INSERT INTO tutor_chats (user_id,context_type,role,message,created_at) VALUES (?,'general','user',?,datetime('now','-400 days'))").run(learner.id, MARK);
    db.prepare("INSERT INTO tutor_chats (user_id,context_type,role,message,created_at) VALUES (?,'general','user',?,datetime('now','-10 days'))").run(learner.id, MARK);
    db.prepare("INSERT INTO security_events (user_id,kind,status,path,created_at) VALUES (?,'forbidden',403,'/x',datetime('now','-400 days'))").run(learner.id);
    const tutorBefore = db.prepare("SELECT COUNT(*) n FROM tutor_chats WHERE message=?").get(MARK).n;
    await runAutomaticRetention();
    expect(db.prepare("SELECT COUNT(*) n FROM tutor_chats WHERE message=?").get(MARK).n).toBe(tutorBefore);
    await request(app).put("/api/admin/retention").set(A(admin.token)).send({ policy: { tutor_chats: 365, security_events: 365 }, confirm: true });
    await runAutomaticRetention();
    expect(db.prepare("SELECT COUNT(*) n FROM tutor_chats WHERE message=? AND created_at < datetime('now','-365 days')").get(MARK).n).toBe(0);
    expect(db.prepare("SELECT COUNT(*) n FROM tutor_chats WHERE message=?").get(MARK).n).toBeGreaterThanOrEqual(1);
    expect(db.prepare("SELECT COUNT(*) n FROM security_events WHERE created_at < datetime('now','-365 days')").get().n).toBe(0);
    await request(app).put("/api/admin/retention").set(A(admin.token)).send({ policy: { tutor_chats: 0, security_events: 0 } });
  });

  it("manual by-age purge needs a period of at least 30 days and confirmation", async () => {
    const tk = admin.token;
    expect((await request(app).post("/api/admin/retention/run").set(A(tk)).send({ category: "tutor_chats", days: 5, confirm: true })).status).toBe(400);
    expect((await request(app).post("/api/admin/retention/run").set(A(tk)).send({ category: "tutor_chats", days: 365 })).status).toBe(409);
    const ok = await request(app).post("/api/admin/retention/run").set(A(tk)).send({ category: "tutor_chats", days: 365, confirm: true });
    expect(ok.status).toBe(200);
    expect(ok.body.rows).toBeGreaterThanOrEqual(0);
  });
});

describe("audit and storage", () => {
  it("audit rows hold counts only, never chat content", () => {
    const rows = db.prepare("SELECT action, detail FROM audit_log WHERE action LIKE 'retention.%' OR action='vp_chat.purge'").all();
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(String(r.detail || "")).not.toContain(MARK);
  });

  it("compaction reports size before and after and switches the file to incremental auto-vacuum", () => {
    const out = compactDatabase();
    expect(out.before.fileBytes).toBeGreaterThan(0);
    expect(out.after.autoVacuum).toBe("incremental");
    expect(storageInfo().autoVacuum).toBe("incremental");
    // A second call only releases free pages.
    expect(compactDatabase().after.autoVacuum).toBe("incremental");
  });
});

describe("class and exam periods in bulk", () => {
  it("sets and clears periods for many classes at once, admin only", async () => {
    const a = newClass("bulk-a", null);
    const b = newClass("bulk-b", null);
    const tk = admin.token;
    const set = await request(app).put("/api/admin/retention/items").set(A(tk)).send({ kind: "class", ids: [a, b], days: 180 });
    expect(set.status).toBe(200);
    expect(set.body.changed).toBe(2);
    const list = await request(app).get("/api/admin/retention/items?kind=class").set(A(tk));
    expect(list.body.rows.find((r) => r.id === a).retention_days).toBe(180);
    const clear = await request(app).put("/api/admin/retention/items").set(A(tk)).send({ kind: "class", ids: [a, b], days: null });
    expect(clear.body.changed).toBe(2);
    expect(db.prepare("SELECT retention_days FROM classes WHERE id=?").get(a).retention_days).toBeNull();
    const exams = await request(app).get("/api/admin/retention/items?kind=exam").set(A(tk));
    expect(exams.status).toBe(200);
    expect(Array.isArray(exams.body.rows)).toBe(true);
    const bad = await request(app).put("/api/admin/retention/items").set(A(tk)).send({ kind: "exam", ids: [a], days: 3 });
    expect(bad.status).toBe(400);
    const denied = await request(app).get("/api/admin/retention").set(A((await login("teacher")).body.token));
    expect([401, 403]).toContain(denied.status);
  });
});

/* Archived classes and exams: deleted only when archived, old enough, not research-linked,
   not used by an active exam, not mid-grading. Deleting removes their grades too. */
describe("archived classes and exams", () => {
  const archivedClass = ({ days = 400, retention = null, studyId = null, active = 0, tag = "x" } = {}) => {
    const id = db.prepare(`INSERT INTO classes(name_en,name_fa,code,owner_id,university_id,max_attempts,log_transcript,active,study_id,retention_days,created_at)
      VALUES (?,?,?,?,?,100,1,?,?,?,datetime('now', ?))`)
      .run(`Arc ${tag}`, `arc ${tag}`, `arc-${tag}-${Math.random().toString(36).slice(2, 8)}`, teacher.id, teacher.university_id, active, studyId, retention, `-${days} days`).lastInsertRowid;
    db.prepare("INSERT INTO class_members(class_id,user_id) VALUES (?,?)").run(id, learner.id);
    const att = db.prepare(`INSERT INTO attempts (user_id,type,case_id,class_id,score,transcript_json,eval_json,created_at)
      VALUES (?, 'vp', ?, ?, 91, ?, '{"ok":true}', datetime('now', ?))`).run(learner.id, caseId, id, `{"m":"${MARK}"}`, `-${days} days`).lastInsertRowid;
    const sid = db.prepare(`INSERT INTO vp_sessions (user_id,case_id,class_id,logging_enabled,started_at,started_ms,finished_at,attempt_id,progress_json)
      VALUES (?,?,?,1,datetime('now', ?),0,datetime('now', ?),?,?)`).run(learner.id, caseId, id, `-${days + 1} days`, `-${days} days`, att, `{"m":"${MARK}"}`).lastInsertRowid;
    db.prepare("INSERT INTO vp_session_events (session_id,seq,at_ms,kind,payload_json) VALUES (?,1,1,'student_msg',?)").run(sid, `{"text":"${MARK}"}`);
    const form = db.prepare("INSERT INTO questionnaire_forms (class_id, created_by) VALUES (?, ?)").run(id, teacher.id).lastInsertRowid;
    db.prepare("INSERT INTO questionnaire_responses (form_id, user_id, answers_json) VALUES (?,?,?)").run(form, learner.id, `{"a":"${MARK}"}`);
    return { id, att, sid, form };
  };
  const exists = (table, id) => !!db.prepare(`SELECT 1 FROM ${table} WHERE id=?`).get(id);

  it("an archived class with no period of its own is kept while the global period is off", async () => {
    const c = archivedClass({ tag: "keep" });
    await runAutomaticRetention();
    expect(exists("classes", c.id)).toBe(true);
  });

  it("an explicit keep (0) on the class beats an enabled global period", async () => {
    const kept = archivedClass({ tag: "pin", retention: 0 });
    const inherits = archivedClass({ tag: "inh" });
    await request(app).put("/api/admin/retention").set(A(admin.token)).send({ policy: { academic_items: 365 }, confirm: true });
    await runAutomaticRetention();
    expect(exists("classes", kept.id)).toBe(true);
    expect(exists("classes", inherits.id)).toBe(false);
    await request(app).put("/api/admin/retention").set(A(admin.token)).send({ policy: { academic_items: 0 } });
  });

  it("an archived class with its own period is deleted with its grades, chats, roster and forms; other grades stay", async () => {
    const other = db.prepare(`INSERT INTO attempts (user_id,type,case_id,score,transcript_json,created_at) VALUES (?, 'vp', ?, 40, NULL, datetime('now','-400 days'))`).run(learner.id, caseId).lastInsertRowid;
    const c = archivedClass({ tag: "gone", retention: 365 });
    const out = await runAutomaticRetention();
    expect(out.academic_items.items).toBeGreaterThanOrEqual(1);
    expect(exists("classes", c.id)).toBe(false);
    expect(exists("attempts", c.att)).toBe(false);
    expect(exists("vp_sessions", c.sid)).toBe(false);
    expect(exists("questionnaire_forms", c.form)).toBe(false);
    expect(db.prepare("SELECT COUNT(*) n FROM class_members WHERE class_id=?").get(c.id).n).toBe(0);
    expect(db.prepare("SELECT COUNT(*) n FROM questionnaire_responses WHERE form_id=?").get(c.form).n).toBe(0);
    expect(exists("attempts", other)).toBe(true);
  });

  it("an active class is never deleted, even with a period", async () => {
    const c = archivedClass({ tag: "live", retention: 30, active: 1 });
    await runAutomaticRetention();
    expect(exists("classes", c.id)).toBe(true);
  });

  it("research-linked and active-exam classes are blocked, and the admin sees why", async () => {
    const research = archivedClass({ tag: "study", retention: 30, studyId: 4242 });
    const used = archivedClass({ tag: "used", retention: 30 });
    const exam = db.prepare("INSERT INTO exams (title_en, active, owner_id, university_id, created_at) VALUES ('Live exam', 1, ?, ?, datetime('now'))").run(teacher.id, teacher.university_id).lastInsertRowid;
    db.prepare(`INSERT INTO attempts (user_id,type,case_id,class_id,exam_id,score,created_at) VALUES (?, 'vp', ?, ?, ?, 10, datetime('now','-400 days'))`).run(learner.id, caseId, used.id, exam);
    expect(blockReason("class", research.id)).toBe("research_linked");
    expect(blockReason("class", used.id)).toBe("used_by_active_exam");
    await runAutomaticRetention();
    expect(exists("classes", research.id)).toBe(true);
    expect(exists("classes", used.id)).toBe(true);
    const tk = admin.token;
    const del = await request(app).post("/api/admin/retention/items/delete").set(A(tk)).send({ kind: "class", ids: [research.id, used.id], confirm: true });
    expect(del.status).toBe(200);
    expect(del.body.items).toBe(0);
    expect(del.body.skipped.map((x) => x.reason).sort()).toEqual(["research_linked", "used_by_active_exam"]);
  });

  it("an archived exam with a period is deleted with its attempts and participants", async () => {
    const ex = db.prepare("INSERT INTO exams (title_en, active, ends_at, owner_id, university_id, retention_days, created_at) VALUES ('Old exam', 0, datetime('now','-400 days'), ?, ?, 365, datetime('now','-400 days'))").run(teacher.id, teacher.university_id).lastInsertRowid;
    db.prepare("INSERT INTO exam_participants (exam_id, user_id) VALUES (?, ?)").run(ex, learner.id);
    const at = db.prepare(`INSERT INTO attempts (user_id,type,case_id,exam_id,score,transcript_json,created_at) VALUES (?, 'exam', ?, ?, 62, '{"answers":[1]}', datetime('now','-400 days'))`).run(learner.id, caseId, ex).lastInsertRowid;
    await runAutomaticRetention();
    expect(exists("exams", ex)).toBe(false);
    expect(exists("attempts", at)).toBe(false);
    expect(db.prepare("SELECT COUNT(*) n FROM exam_participants WHERE exam_id=?").get(ex).n).toBe(0);
  });

  it("the impact preview counts exactly what the delete removes, and deletion needs confirmation", async () => {
    const c = archivedClass({ tag: "impact" });
    const tk = admin.token;
    const imp = await request(app).get(`/api/admin/retention/items/impact?kind=class&id=${c.id}`).set(A(tk));
    expect(imp.status).toBe(200);
    expect(imp.body.blocked).toBeNull();
    expect(imp.body.attempts).toBe(1);
    expect(imp.body.chats).toBe(1);
    expect(imp.body.members).toBe(1);
    expect(imp.body.responses).toBe(1);
    expect((await request(app).post("/api/admin/retention/items/delete").set(A(tk)).send({ kind: "class", ids: [c.id] })).status).toBe(409);
    const done = await request(app).post("/api/admin/retention/items/delete").set(A(tk)).send({ kind: "class", ids: [c.id], confirm: true });
    expect(done.body.items).toBe(1);
    expect(done.body.attempts).toBe(imp.body.attempts);
    expect(done.body.chats).toBe(imp.body.chats);
    expect(exists("classes", c.id)).toBe(false);
  });

  it("admin only; the audit row holds counts and no chat text", async () => {
    const teacherTk = (await login("teacher")).body.token;
    const denied = await request(app).post("/api/admin/retention/items/delete").set(A(teacherTk)).send({ kind: "class", ids: [1], confirm: true });
    expect([401, 403]).toContain(denied.status);
    const rows = db.prepare("SELECT detail FROM audit_log WHERE action='academic.purge'").all();
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(String(r.detail)).not.toContain(MARK);
  });
  /* FERPA 34 CFR 99.10(e): while an inspection request is open, nothing of the item is deleted. */
  it("an inspection hold keeps a class, its chats and its grades until it is released", async () => {
    const c = archivedClass({ tag: "held", retention: 30 });
    const tk = admin.token;
    const on = await request(app).put("/api/admin/retention/items/hold").set(A(tk)).send({ kind: "class", ids: [c.id], hold: true });
    expect(on.status).toBe(200);
    expect(on.body.changed).toBe(1);
    expect(blockReason("class", c.id)).toBe("inspection_hold");
    await runAutomaticRetention();
    expect(exists("classes", c.id)).toBe(true);
    expect(exists("attempts", c.att)).toBe(true);
    expect(db.prepare("SELECT purged_ms FROM vp_sessions WHERE id=?").get(c.sid).purged_ms).toBeNull();
    const del = await request(app).post("/api/admin/retention/items/delete").set(A(tk)).send({ kind: "class", ids: [c.id], confirm: true });
    expect(del.body.items).toBe(0);
    expect(del.body.skipped).toEqual([{ kind: "class", id: c.id, reason: "inspection_hold" }]);
    const off = await request(app).put("/api/admin/retention/items/hold").set(A(tk)).send({ kind: "class", ids: [c.id], hold: false });
    expect(off.status).toBe(409);
    await request(app).put("/api/admin/retention/items/hold").set(A(tk)).send({ kind: "class", ids: [c.id], hold: false, confirm: true });
    expect(blockReason("class", c.id)).toBeNull();
    await runAutomaticRetention();
    expect(exists("classes", c.id)).toBe(false);
    expect(exists("vp_sessions", c.sid)).toBe(false);
    expect(exists("attempts", c.att)).toBe(false);
  });

  it("a held exam also protects an archived class whose attempts belong to it", async () => {
    const cls = archivedClass({ tag: "linked" });
    const ex = db.prepare("INSERT INTO exams (title_en, active, ends_at, owner_id, university_id, created_at, inspection_hold) VALUES ('Held exam', 0, datetime('now','-400 days'), ?, ?, datetime('now','-400 days'), 1)")
      .run(teacher.id, teacher.university_id).lastInsertRowid;
    db.prepare(`UPDATE attempts SET exam_id=? WHERE id=?`).run(ex, cls.att);
    expect(blockReason("class", cls.id)).toBe("inspection_hold");
    expect(blockReason("exam", ex)).toBe("inspection_hold");
    await runAutomaticRetention();
    expect(exists("classes", cls.id)).toBe(true);
    expect(exists("exams", ex)).toBe(true);
  });

  it("a manual purge of a held class's chat is refused, and holds are audited without chat text", async () => {
    const c = archivedClass({ tag: "manual", active: 1, retention: 0 });
    await request(app).put("/api/admin/retention/items/hold").set(A(admin.token)).send({ kind: "class", ids: [c.id], hold: true });
    const { purgeVpAttempts } = await import("../src/lib/retention.js");
    const out = purgeVpAttempts([c.att]);
    expect(out.sessions).toBe(0);
    expect(db.prepare("SELECT purged_ms FROM vp_sessions WHERE id=?").get(c.sid).purged_ms).toBeNull();
    const rows = db.prepare("SELECT detail FROM audit_log WHERE action IN ('inspection.hold','inspection.release')").all();
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(String(r.detail)).not.toContain(MARK);
    await request(app).put("/api/admin/retention/items/hold").set(A(admin.token)).send({ kind: "class", ids: [c.id], hold: false, confirm: true });
  });

  it("the hold is admin only", async () => {
    const c = archivedClass({ tag: "authz" });
    const teacherTk = (await login("teacher")).body.token;
    const res = await request(app).put("/api/admin/retention/items/hold").set(A(teacherTk)).send({ kind: "class", ids: [c.id], hold: true });
    expect([401, 403]).toContain(res.status);
    expect(blockReason("class", c.id)).toBeNull();
  });
});
