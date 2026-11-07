/* r100-learner-case-read.test.js — R100 bug fix.
   A competitive learner opening a virtual-patient case calls GET /api/cases/:id (Exam.jsx). The
   blanket `r.use('/cases')` guard returned 403 university_only for every learner before the
   single-case handler ran, so no learner could open any case. The fix lets a learner read ONE
   learn-track case by id, under the learn-track rule and the VP switch. Everything else stays closed:
   the case list, university cases, students, and VP-off learners. The answer-key fields stay out. */
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import request from "supertest";
import { initDb, initSchema, db } from "../src/db.js";
import { createApp } from "../src/app.js";
import { saveVpatientConfig } from "../src/lib/vpatient.js";

let app, learnerTk, studentTk, learnId, uniId;

beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb();
  initSchema();
  app = createApp();
  learnerTk = (await request(app).post("/api/auth/login").send({ username: "learner", password: "demo" })).body.token;
  studentTk = (await request(app).post("/api/auth/login").send({ username: "40012345", password: "demo" })).body.token;
  const rows = db.prepare("SELECT id, data_json FROM cases WHERE active=1 ORDER BY id").all();
  uniId = rows[0].id;
  learnId = rows[1].id;
  const d = JSON.parse(rows[1].data_json);
  d.track = "learn";
  db.prepare("UPDATE cases SET data_json=? WHERE id=?").run(JSON.stringify(d), learnId);
});

const getCase = (tk, id) => request(app).get(`/api/cases/${id}`).set("Authorization", `Bearer ${tk}`);

describe("learner single-case read (R100)", () => {
  it("VP off: a learner is refused with reason off, not university_only", async () => {
    saveVpatientConfig({ enabled: false });
    const r = await getCase(learnerTk, learnId);
    expect(r.status).toBe(403);
    expect(r.body.reason).toBe("off");
  });

  it("VP on (not premium-only): the learner reads the learn-track case, without answer keys", async () => {
    saveVpatientConfig({ enabled: true, premium_only: false });
    const r = await getCase(learnerTk, learnId);
    expect(r.status).toBe(200);
    expect(r.body.id).toBe(learnId);
    expect(r.body.checklist_id).toBeUndefined();
    expect(JSON.stringify(r.body)).not.toMatch(/"answer_key"|"rubric"|"correct"/);
  });

  it("a learner still cannot read a university case", async () => {
    const r = await getCase(learnerTk, uniId);
    expect(r.status).toBe(403);
    expect(r.body.error).toBe("university_only");
  });

  it("a learner still cannot list cases", async () => {
    const r = await request(app).get("/api/cases").set("Authorization", `Bearer ${learnerTk}`);
    expect(r.status).toBe(403);
    expect(r.body.error).toBe("university_only");
  });

  it("a student still cannot read the learn-track case", async () => {
    const r = await getCase(studentTk, learnId);
    expect(r.status).toBe(403);
    expect(r.body.error).toBe("wrong_track");
  });

  it("the learner's single-case read cannot be used for writes", async () => {
    const r = await request(app).put(`/api/cases/${learnId}`).set("Authorization", `Bearer ${learnerTk}`).send({});
    expect(r.status).toBe(403);
  });
});
