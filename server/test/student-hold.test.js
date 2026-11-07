/* R90: per-student inspection request. While a request is open, every record of that
   student is kept: the class/exam they are on, their account, their VP encounters and
   their tutor chats. Closing the request releases the protection. */
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import request from "supertest";
import { createApp } from "../src/app.js";
import { initDb, db } from "../src/db.js";
import { purgeCategory, blockReason, deleteAcademicNow, openStudentHold, closeStudentHold, purgeVpAttempts, studentOnInspectionHold, listStudentHolds } from "../src/lib/retention.js";

let app, adm, tch;
const login = (u, p = "demo") => request(app).post("/api/auth/login").send({ username: u, password: p });
const token = async (u, p = "demo") => (await login(u, p)).body.token;
const A = (tk) => ({ Authorization: `Bearer ${tk}` });
const idOf = (username) => db.prepare("SELECT id FROM users WHERE username=?").get(username).id;

beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb();
  app = createApp();
  adm = await token("admin");
  tch = await token("teacher");
});

function archivedClassWith(studentId) {
  return request(app).post("/api/classes").set(A(tch)).send({ name_en: "R90 hold", name_fa: "نگه‌داری", maxAttempts: 2 })
    .then((res) => {
      const cid = res.body.id;
      db.prepare("INSERT OR IGNORE INTO class_members (class_id,user_id) VALUES (?,?)").run(cid, studentId);
      db.prepare("UPDATE classes SET active=0 WHERE id=?").run(cid);
      return cid;
    });
}

describe("per-student inspection hold (R90)", () => {
  it("an archived class with a student and no hold is eligible", async () => {
    const sid = idOf("40012345");
    const cid = await archivedClassWith(sid);
    expect(blockReason("class", cid)).toBeNull();
  });

  it("an open request blocks the class the student is on, and opening it again is idempotent", async () => {
    const sid = idOf("40012345");
    const cid = await archivedClassWith(sid);
    const first = openStudentHold(sid, { reference: "FERPA-TEST-1" });
    expect(first.created).toBe(true);
    expect(blockReason("class", cid)).toBe("inspection_hold");
    expect(openStudentHold(sid).created).toBe(false);
    const out = deleteAcademicNow("class", [cid]);
    expect(JSON.stringify(out)).toContain("inspection_hold");
    expect(db.prepare("SELECT id FROM classes WHERE id=?").get(cid)).toBeTruthy();
    closeStudentHold(first.id);
    expect(blockReason("class", cid)).toBeNull();
  });

  it("refuses non-students and unknown users", () => {
    expect(openStudentHold(idOf("admin"))).toEqual({ error: "not_a_student" });
    expect(openStudentHold(999999)).toEqual({ error: "not_found" });
  });

  it("blocks deleting the student's account while the request is open", async () => {
    const made = await request(app).post("/api/users").set(A(adm))
      .send({ username: "r90_hold_student", password: "Hold-R90-pass", role: "student", name_fa: "دانشجو", name_en: "Hold", university_id: 1 });
    expect(made.status).toBe(200);
    const uid = made.body.id ?? idOf("r90_hold_student");
    const hold = openStudentHold(uid, { reference: "FERPA-TEST-2" });
    expect(studentOnInspectionHold(uid)).toBe(true);
    const del = await request(app).delete(`/api/admin/users/${uid}`).set(A(adm));
    expect(del.status).toBe(409);
    expect(del.body.error).toBe("inspection_hold");
    expect(db.prepare("SELECT id FROM users WHERE id=?").get(uid)).toBeTruthy();
    closeStudentHold(hold.id);
    expect(studentOnInspectionHold(uid)).toBe(false);
    const ok = await request(app).delete(`/api/admin/users/${uid}`).set(A(adm));
    expect(ok.status).toBe(200);
  });

  it("keeps a held student's VP encounter out of manual purge until the request closes", () => {
    const sid = idOf("40012345");
    const cid = db.prepare("SELECT class_id FROM class_members WHERE user_id=? LIMIT 1").get(sid)?.class_id;
    const att = db.prepare("INSERT INTO attempts (user_id,type,class_id,created_at) VALUES (?,?,?,datetime('now','-400 days'))").run(sid, "vp", cid || null);
    const caseId = db.prepare("SELECT id FROM cases ORDER BY id LIMIT 1").get()?.id ?? 1;
    const sess = db.prepare("INSERT INTO vp_sessions (user_id,case_id,class_id,started_ms,finished_at,attempt_id) VALUES (?,?,?,?,datetime('now','-400 days'),?)")
      .run(sid, caseId, cid || null, Date.now() - 400 * 86400000, att.lastInsertRowid);
    const hold = openStudentHold(sid, { reference: "FERPA-TEST-3" });
    const held = purgeVpAttempts([Number(att.lastInsertRowid)]);
    expect(held.sessions).toBe(0);
    expect(db.prepare("SELECT purged_ms FROM vp_sessions WHERE id=?").get(sess.lastInsertRowid).purged_ms).toBeNull();
    closeStudentHold(hold.id);
    const freed = purgeVpAttempts([Number(att.lastInsertRowid)]);
    expect(freed.sessions).toBe(1);
  });

  it("keeps a held student's old tutor chats out of the tutor-chat purge", async () => {
    const sid = idOf("40012345");
    db.prepare("INSERT INTO tutor_chats (user_id,context_type,context_id,role,message,created_at) VALUES (?,?,?,?,?,datetime('now','-400 days'))")
      .run(sid, "general", null, "user", "R90 old question");
    const mine = () => db.prepare("SELECT COUNT(*) n FROM tutor_chats WHERE user_id=? AND message='R90 old question'").get(sid).n;
    const hold = openStudentHold(sid, { reference: "FERPA-TEST-6" });
    await purgeCategory("tutor_chats", 30);
    expect(mine()).toBe(1);
    closeStudentHold(hold.id);
    await purgeCategory("tutor_chats", 30);
    expect(mine()).toBe(0);
  });

  it("refuses a roster replace that would drop a held student, and allows it when they stay", async () => {
    const sid = idOf("40012345");
    const other = idOf("40067890");
    const cid = await archivedClassWith(sid);
    const hold = openStudentHold(sid, { reference: "FERPA-TEST-7" });
    const drop = await request(app).put(`/api/classes/${cid}/members`).set(A(tch)).send({ userIds: [other] });
    expect(drop.status).toBe(409);
    expect(drop.body.error).toBe("inspection_hold");
    expect(db.prepare("SELECT 1 FROM class_members WHERE class_id=? AND user_id=?").get(cid, sid)).toBeTruthy();
    const keep = await request(app).put(`/api/classes/${cid}/members`).set(A(tch)).send({ userIds: [sid, other] });
    expect(keep.status).toBe(200);
    closeStudentHold(hold.id);
  });

  it("refuses a participant replace that would drop a held student from an exam", async () => {
    const sid = idOf("40012345");
    const other = idOf("40067890");
    const ex = db.prepare("INSERT INTO exams (title_en,title_fa,owner_id,university_id,active) VALUES ('R90 hold','نگه‌داری',?,1,1)").run(idOf("teacher"));
    const eid = Number(ex.lastInsertRowid);
    db.prepare("INSERT OR IGNORE INTO exam_participants (exam_id,user_id) VALUES (?,?)").run(eid, sid);
    const hold = openStudentHold(sid, { reference: "FERPA-TEST-8" });
    const drop = await request(app).put(`/api/exams/${eid}/participants`).set(A(tch)).send({ userIds: [other] });
    expect(drop.status).toBe(409);
    expect(db.prepare("SELECT 1 FROM exam_participants WHERE exam_id=? AND user_id=?").get(eid, sid)).toBeTruthy();
    closeStudentHold(hold.id);
  });

  it("refuses a manual delete of a held student's attempt", async () => {
    const sid = idOf("40012345");
    const att = db.prepare("INSERT INTO attempts (user_id,type,created_at) VALUES (?,'vp',datetime('now'))").run(sid);
    const hold = openStudentHold(sid, { reference: "FERPA-TEST-9" });
    const res = await request(app).delete(`/api/reports/attempts/${att.lastInsertRowid}`).set(A(adm));
    expect(res.status).toBe(409);
    expect(db.prepare("SELECT 1 FROM attempts WHERE id=?").get(att.lastInsertRowid)).toBeTruthy();
    closeStudentHold(hold.id);
  });

  it("lists open requests with counts and never the student's answers", async () => {
    const sid = idOf("40012345");
    const hold = openStudentHold(sid, { reference: "FERPA-TEST-4" });
    const list = listStudentHolds();
    const row = list.find((r) => r.id === hold.id);
    expect(row).toBeTruthy();
    expect(row).not.toHaveProperty("transcript_json");
    expect(typeof row.attempts).toBe("number");
    const res = await request(app).get("/api/admin/retention/student-holds").set(A(adm));
    expect(res.status).toBe(200);
    expect(res.body.holds.map((h) => h.id)).toContain(hold.id);
    closeStudentHold(hold.id);
  });

  it("the admin routes need confirm to close and reject a bad id", async () => {
    const sid = idOf("40012345");
    const created = await request(app).post("/api/admin/retention/student-holds").set(A(adm)).send({ studentNo: "40012345", reference: "FERPA-TEST-5" });
    expect(created.status).toBe(200);
    expect(created.body.created).toBe(true);
    const noConfirm = await request(app).post(`/api/admin/retention/student-holds/${created.body.id}/close`).set(A(adm)).send({});
    expect(noConfirm.status).toBe(409);
    const bad = await request(app).post("/api/admin/retention/student-holds/abc/close").set(A(adm)).send({ confirm: true });
    expect(bad.status).toBe(400);
    const closed = await request(app).post(`/api/admin/retention/student-holds/${created.body.id}/close`).set(A(adm)).send({ confirm: true });
    expect(closed.status).toBe(200);
    expect(closed.body.changed).toBe(1);
    expect(studentOnInspectionHold(sid)).toBe(false);
  });
});
