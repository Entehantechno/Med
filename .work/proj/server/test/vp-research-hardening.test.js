/* ================================================================
   vp-research-hardening.test.js — regression tests for the fixes made
   before the virtual-patient platform is used as a research instrument.

   Each test here pins a real bug that was found and fixed:
     1. class max_attempts was UI-only → a student could replay a scenario
        unlimited times through the API (corrupts gradebook + study data)
     2. "anonymous" questionnaires stored the user id, and the UNIQUE index
        could not deduplicate them (NULLs are distinct in SQLite)
     3. POST /api/research/event accepted arbitrary rows from any user
     4. an AI scoring failure silently downgraded the score with no trace
   ================================================================ */
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import request from "supertest";
import { initDb, db } from "../src/db.js";
import { createApp } from "../src/app.js";
import { pseudonymFor } from "../src/lib/pseudonym.js";

let app;
const login = (u, p = "demo") => request(app).post("/api/auth/login").send({ username: u, password: p });
async function token(u, p = "demo") { return (await login(u, p)).body.token; }
const A = (tk) => ({ Authorization: `Bearer ${tk}` });

const vpSession = {
  messages: [{ role: "student", text: "سلام من دکتر هستم، درد قفسه سینه دارید؟" },
             { role: "patient", text: "بله دکتر" }],
  tests: ["ecg"], imaging: [], ddx: ["STEMI"], finalDx: "STEMI",
};

/* Fresh class owned by `teacher`, with `stuId` enrolled and `caseId` attached. */
async function makeClass(tk, stuId, caseId, maxAttempts = 1, extra = {}) {
  const created = await request(app).post("/api/classes").set(A(tk))
    .send({ name_en: `Hardening ${Math.random()}`, name_fa: "سخت‌گیری", maxAttempts, ...extra });
  const cid = created.body.id;
  await request(app).put(`/api/classes/${cid}/members`).set(A(tk)).send({ userIds: [stuId] });
  await request(app).put(`/api/classes/${cid}/cases`).set(A(tk)).send({ cases: [{ case_id: caseId, weight: 1 }] });
  return cid;
}

beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb();
  app = createApp();
});

describe("virtual patient: attempt budget is enforced server-side", () => {
  it("refuses evaluate / patient-reply / order once max_attempts is spent", async () => {
    const ttk = await token("teacher");
    const stuId = ((await request(app).get("/api/users").set(A(ttk))).body).find((u) => u.username === "40012345").id;
    const cid = await makeClass(ttk, stuId, 1, 1);
    const stk = await token("40012345");

    const first = await request(app).post("/api/exam/evaluate").set(A(stk))
      .send({ caseId: 1, classId: cid, lang: "fa", durationSec: 120, session: vpSession });
    expect(first.status).toBe(200);

    // The budget is now gone: every entry point must refuse, not just the button.
    const second = await request(app).post("/api/exam/evaluate").set(A(stk))
      .send({ caseId: 1, classId: cid, lang: "fa", durationSec: 120, session: vpSession });
    expect(second.status).toBe(403);
    expect(second.body.reason).toBe("attempts_exhausted");

    const chat = await request(app).post("/api/exam/patient-reply").set(A(stk))
      .send({ caseId: 1, classId: cid, userText: "سلام", history: [], lang: "fa" });
    expect(chat.status).toBe(403);
    expect(chat.body.reason).toBe("attempts_exhausted");

    const order = await request(app).post("/api/exam/order").set(A(stk))
      .send({ caseId: 1, classId: cid, kind: "lab", query: "ecg", lang: "fa" });
    expect(order.status).toBe(403);
    expect(order.body.reason).toBe("attempts_exhausted");
    expect(order.body.stage).toBe("order");

    // Exactly one attempt row exists — the study data stays 1-per-student.
    const rows = db.prepare("SELECT id FROM attempts WHERE user_id=? AND class_id=?").all(stuId, cid);
    expect(rows.length).toBe(1);
  });

  it("omitting classId does not bypass the class attempt cap", async () => {
    const ttk = await token("teacher");
    const stuId = ((await request(app).get("/api/users").set(A(ttk))).body).find((u) => u.username === "40012345").id;
    // A case that belongs to NO other class, so there is exactly one budget in
    // play and the test is unambiguous.
    const newCaseId = (await request(app).post("/api/cases").set(A(ttk))
      .send({ difficulty: "medium", title_en: "Cap probe", title_fa: "پ", chief_en: "pain", chief_fa: "درد" })).body.id;
    const cid = await makeClass(ttk, stuId, newCaseId, 1);
    const stk = await token("40012345");

    // No classId in the body: the student only reaches this case through that
    // class, so the class limit must still apply.
    const first = await request(app).post("/api/exam/evaluate").set(A(stk))
      .send({ caseId: newCaseId, lang: "fa", durationSec: 60, session: vpSession });
    expect(first.status).toBe(200);
    const second = await request(app).post("/api/exam/evaluate").set(A(stk))
      .send({ caseId: newCaseId, lang: "fa", durationSec: 60, session: vpSession });
    expect(second.status).toBe(403);
    expect(second.body.reason).toBe("attempts_exhausted");
    expect(cid).toBeTruthy();
  });

  it("a student enrolled in two classes using one case keeps the unused quota", async () => {
    const ttk = await token("teacher");
    const stuId = ((await request(app).get("/api/users").set(A(ttk))).body).find((u) => u.username === "40012345").id;
    const newCaseId = (await request(app).post("/api/cases").set(A(ttk))
      .send({ difficulty: "medium", title_en: "Two-class probe", title_fa: "پ", chief_en: "pain", chief_fa: "درد" })).body.id;
    await makeClass(ttk, stuId, newCaseId, 1);
    await makeClass(ttk, stuId, newCaseId, 1);
    const stk = await token("40012345");
    const post = () => request(app).post("/api/exam/evaluate").set(A(stk))
      .send({ caseId: newCaseId, lang: "fa", durationSec: 60, session: vpSession });
    // Two classes × 1 attempt each = 2 unattributed attempts allowed, then stop.
    expect((await post()).status).toBe(200);
    expect((await post()).status).toBe(200);
    expect((await post()).status).toBe(403);
  });

  it("allows the configured number of attempts and no more", async () => {
    const ttk = await token("teacher");
    const stuId = ((await request(app).get("/api/users").set(A(ttk))).body).find((u) => u.username === "40012345").id;
    const cid = await makeClass(ttk, stuId, 1, 3);
    const stk = await token("40012345");
    const post = () => request(app).post("/api/exam/evaluate").set(A(stk))
      .send({ caseId: 1, classId: cid, lang: "fa", durationSec: 60, session: vpSession });
    expect((await post()).status).toBe(200);
    expect((await post()).status).toBe(200);
    expect((await post()).status).toBe(200);
    expect((await post()).status).toBe(403);
  });

  it("teachers and admins keep unlimited QA access", async () => {
    const ttk = await token("teacher");
    const post = () => request(app).post("/api/exam/evaluate").set(A(ttk))
      .send({ caseId: 1, classId: 1, lang: "fa", durationSec: 60, session: vpSession });
    expect((await post()).status).toBe(200);
    expect((await post()).status).toBe(200);
  });

  it("validates the client-reported duration instead of trusting it", async () => {
    const ttk = await token("teacher");
    const bad = await request(app).post("/api/exam/evaluate").set(A(ttk))
      .send({ caseId: 1, lang: "fa", durationSec: -999, session: vpSession });
    expect(bad.status).toBe(200);
    expect(bad.body.meta.durationSecUsed).toBe(0);
    expect(bad.body.meta.durationSecClient).toBe(-999);

    const absurd = await request(app).post("/api/exam/evaluate").set(A(ttk))
      .send({ caseId: 1, lang: "fa", durationSec: 99999999, session: vpSession });
    expect(absurd.body.meta.durationSecUsed).toBe(6 * 60 * 60);
  });

  it("records which engine scored the attempt (research auditability)", async () => {
    const ttk = await token("teacher");
    const res = await request(app).post("/api/exam/evaluate").set(A(ttk))
      .send({ caseId: 1, lang: "fa", durationSec: 60, session: vpSession });
    expect(res.body.meta).toBeTruthy();
    // No AI key configured in tests → the deterministic keyword engine scored it.
    expect(res.body.meta.scoredBy).toBe("mock");
    // The stored eval_json carries the same provenance for later analysis.
    const row = db.prepare("SELECT eval_json FROM attempts WHERE id=?").get(res.body.attemptId);
    expect(JSON.parse(row.eval_json).meta.scoredBy).toBe("mock");
  });
});

describe("order catalog is enforced after access", () => {
  it("rejects empty and unknown queries with 400, accepts a catalog lab", async () => {
    const ttk = await token("teacher");
    const stuId = ((await request(app).get("/api/users").set(A(ttk))).body).find((u) => u.username === "40012345").id;
    const cid = await makeClass(ttk, stuId, 1, 4);
    const stk = await token("40012345");

    const empty = await request(app).post("/api/exam/order").set(A(stk))
      .send({ caseId: 1, classId: cid, kind: "lab", query: "", lang: "fa" });
    expect(empty.status).toBe(400);
    expect(empty.body.error).toBe("query_required");
    expect(empty.body.stage).toBe("order");

    const unknown = await request(app).post("/api/exam/order").set(A(stk))
      .send({ caseId: 1, classId: cid, kind: "lab", query: "zzzzz-not-a-lab", lang: "fa" });
    expect(unknown.status).toBe(400);
    expect(unknown.body.error).toBe("not_in_catalog");
    expect(unknown.body.stage).toBe("order");

    const ecgAsLab = await request(app).post("/api/exam/order").set(A(stk))
      .send({ caseId: 1, classId: cid, kind: "lab", query: "ecg", lang: "fa" });
    expect(ecgAsLab.status).toBe(400);
    expect(ecgAsLab.body.error).toBe("not_in_catalog");

    const trop = await request(app).post("/api/exam/order").set(A(stk))
      .send({ caseId: 1, classId: cid, kind: "lab", query: "تروپونین", lang: "fa" });
    expect(trop.status).toBe(200);
    expect(trop.body.text).toBeTruthy();
  });
});

describe("VP path stages are named on every refusal", () => {
  it("empty chat is 400 chat; missing case is 404 case; evaluate 403 is evaluate", async () => {
    const ttk = await token("teacher");
    const emptyChat = await request(app).post("/api/exam/patient-reply").set(A(ttk))
      .send({ caseId: 1, userText: "   ", lang: "fa" });
    expect(emptyChat.status).toBe(400);
    expect(emptyChat.body.error).toBe("text_required");
    expect(emptyChat.body.stage).toBe("chat");

    const missing = await request(app).post("/api/exam/session-start").set(A(ttk))
      .send({ caseId: 999999, lang: "fa" });
    expect(missing.status).toBe(404);
    expect(missing.body.stage).toBe("case");

    const stk = await token("40012345");
    const stuId = ((await request(app).get("/api/users").set(A(ttk))).body).find((u) => u.username === "40012345").id;
    const cid = await makeClass(ttk, stuId, 1, 1);
    const first = await request(app).post("/api/exam/evaluate").set(A(stk))
      .send({ caseId: 1, classId: cid, lang: "fa", durationSec: 30, session: vpSession });
    expect(first.status).toBe(200);
    const second = await request(app).post("/api/exam/evaluate").set(A(stk))
      .send({ caseId: 1, classId: cid, lang: "fa", durationSec: 30, session: vpSession });
    expect(second.status).toBe(403);
    expect(second.body.reason).toBe("attempts_exhausted");
    expect(second.body.stage).toBe("evaluate");
  });
});

describe("questionnaires: anonymity is real and duplicates are impossible", () => {
  it("an anonymous form stores no identity but still dedupes one response per person", async () => {
    const ttk = await token("teacher");
    const form = (await request(app).post("/api/questionnaires/admin/forms").set(A(ttk))
      .send({ title_en: "Anon", title_fa: "ناشناس", scope: "general", anonymous: true,
              questions: [{ id: "q1", type: "likert", label_en: "satisfied", max: 5 }] })).body;
    const stk = await token("40012345");

    for (let i = 0; i < 4; i++) {
      const r = await request(app).post(`/api/questionnaires/${form.id}/responses`).set(A(stk))
        .send({ answers: { q1: i + 1 } });
      expect(r.status).toBe(200);
    }

    const all = (await request(app).get("/api/questionnaires/admin/responses").set(A(ttk))).body.responses
      .filter((x) => x.form_id === form.id);
    expect(all.length).toBe(1);                 // 4 submits → 1 stored row
    expect(all[0].user_id).toBeNull();          // no identity recorded
    expect(all[0].user_name).toBeNull();        // and no leaked name in the admin view
    expect(all[0].anonymous).toBe(true);
    expect(all[0].answers.q1).toBe(4);          // the LAST submission wins (upsert)
    expect(all[0].pseudonym).toBeTruthy();       // pairing code is present
  });

  it("a non-anonymous form still records who answered", async () => {
    const ttk = await token("teacher");
    const form = (await request(app).post("/api/questionnaires/admin/forms").set(A(ttk))
      .send({ title_en: "Named", title_fa: "باشناس", scope: "general", anonymous: false,
              questions: [{ id: "q1", type: "likert", label_en: "x", max: 5 }] })).body;
    const stk = await token("40012345");
    await request(app).post(`/api/questionnaires/${form.id}/responses`).set(A(stk)).send({ answers: { q1: 3 } });
    const row = (await request(app).get("/api/questionnaires/admin/responses").set(A(ttk))).body.responses
      .find((x) => x.form_id === form.id);
    expect(row.user_id).toBeTruthy();
    expect(row.anonymous).toBe(false);
  });

  it("does not re-prompt a student who already answered an anonymous form", async () => {
    const ttk = await token("teacher");
    const form = (await request(app).post("/api/questionnaires/admin/forms").set(A(ttk))
      .send({ title_en: "AnonPrompt", title_fa: "پ", scope: "general", anonymous: true,
              questions: [{ id: "q1", type: "likert", label_en: "x", max: 5 }] })).body;
    const stk = await token("40012345");
    const before = (await request(app).get("/api/questionnaires/prompts").set(A(stk))).body.forms;
    expect(before.map((f) => f.id)).toContain(form.id);
    await request(app).post(`/api/questionnaires/${form.id}/responses`).set(A(stk)).send({ answers: { q1: 2 } });
    const after = (await request(app).get("/api/questionnaires/prompts").set(A(stk))).body.forms;
    expect(after.map((f) => f.id)).not.toContain(form.id);
  });
});

describe("research event ingest is locked down", () => {
  it("rejects unknown event types, unknown contexts, inactive studies and huge payloads", async () => {
    const ttk = await token("teacher");
    const study = (await request(app).post("/api/research/studies").set(A(ttk))
      .send({ title_en: "VP study", title_fa: "مطالعه", active: false })).body;
    const stk = await token("40012345");
    const post = (body) => request(app).post("/api/research/event").set(A(stk)).send(body);

    expect((await post({ event_type: "DROP TABLE users" })).status).toBe(400);
    expect((await post({ event_type: "session_started", context_type: "../../etc" })).status).toBe(400);
    expect((await post({ event_type: "session_started", study_id: 999999 })).status).toBe(404);
    expect((await post({ event_type: "session_started", study_id: study.id })).status).toBe(403);
    expect((await post({ event_type: "session_started", data: { blob: "x".repeat(20000) } })).status).toBe(413);
  });

  it("accepts a well-formed event for an ACTIVE study", async () => {
    const ttk = await token("teacher");
    /* consent_required is off here on purpose: this test is about the ingest
       lockdown (vocabulary, size caps, study state), not about consent. The
       consent gate on this same endpoint is covered in
       research-consent.test.js. */
    const study = (await request(app).post("/api/research/studies").set(A(ttk))
      .send({ title_en: "VP study live", title_fa: "مطالعهٔ فعال", active: true, consent_required: false })).body;
    const stk = await token("40012345");
    const res = await request(app).post("/api/research/event").set(A(stk))
      .send({ event_type: "session_started", study_id: study.id, context_type: "case", context_id: 1, data: { caseId: 1 } });
    expect(res.status).toBe(200);
    const row = db.prepare("SELECT * FROM research_events WHERE study_id=?").get(study.id);
    expect(row.event_type).toBe("session_started");
    expect(row.user_id).toBeTruthy();
  });
});

describe("pseudonym helper", () => {
  it("is stable per user+scope and differs across scopes", () => {
    const a = pseudonymFor(3, "q");
    const b = pseudonymFor(3, "q");
    const c = pseudonymFor(4, "q");
    const d = pseudonymFor(3, "study:7");
    expect(a).toBe(b);          // stable → pairing works
    expect(a).not.toBe(c);      // different users differ
    expect(a).not.toBe(d);      // different scopes differ (no cross-study join)
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(pseudonymFor(null, "q")).toBeNull();
    expect(pseudonymFor(0, "q")).toBeNull();
  });
});
