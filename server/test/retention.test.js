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
import { readPolicy, savePolicy, previewPurge, runAutomaticRetention, purgeCategory, compactDatabase, storageInfo } from "../src/lib/retention.js";

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
    expect(p).toEqual({ vp_chats: 0, tutor_chats: 0, security_events: 0, rum_vitals: 45 });
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
