/* ================================================================
   vp-conversation-logging.test.js — Phase 2: conversation logging.

   The rule under test is PRIVACY BY DEFAULT: a class records nothing about the
   conversation unless the teacher explicitly turned the switch on. Turning it
   on must then capture a timestamped, analysable log; leaving it off must leave
   genuinely no trace of the conversation while still recording the score.
   ================================================================ */
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import request from "supertest";
import { initDb, db } from "../src/db.js";
import { createApp } from "../src/app.js";

let app;
const login = (u, p = "demo") => request(app).post("/api/auth/login").send({ username: u, password: p });
async function token(u, p = "demo") { return (await login(u, p)).body.token; }
const A = (tk) => ({ Authorization: `Bearer ${tk}` });

const vpSession = {
  messages: [{ role: "student", text: "سلام، درد قفسه سینه دارید؟" },
             { role: "patient", text: "بله دکتر، از یک ساعت پیش" }],
  tests: ["ecg", "troponin"], imaging: ["cxr"], ddx: ["STEMI", "GERD"], finalDx: "STEMI",
};
const vpEvents = [
  { kind: "student_msg", atMs: 1000, text: "سلام، درد قفسه سینه دارید؟" },
  { kind: "patient_msg", atMs: 2500, text: "بله دکتر، از یک ساعت پیش", source: "mock" },
  { kind: "lab_order", atMs: 4000, query: "ecg" },
  { kind: "lab_result", atMs: 4200, query: "ecg", text: "ST elevation V1-V4", found: true },
  { kind: "imaging_order", atMs: 6000, query: "cxr" },
  { kind: "ddx_add", atMs: 7000, text: "STEMI" },
  { kind: "final_dx", atMs: 9000, text: "STEMI" },
  { kind: "finish", atMs: 10000 },
];

async function makeClass(tk, stuId, caseId, { maxAttempts = 5, logTranscript = false } = {}) {
  const cid = (await request(app).post("/api/classes").set(A(tk))
    .send({ name_en: `Log ${Math.random()}`, name_fa: "لاگ", maxAttempts, logTranscript })).body.id;
  await request(app).put(`/api/classes/${cid}/members`).set(A(tk)).send({ userIds: [stuId] });
  await request(app).put(`/api/classes/${cid}/cases`).set(A(tk)).send({ cases: [{ case_id: caseId, weight: 1 }] });
  return cid;
}

beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb();
  app = createApp();
});

describe("conversation logging is OFF unless the teacher turns it on", () => {
  it("a new class logs conversations by default so the teacher can review them", async () => {
    const ttk = await token("teacher");
    const created = await request(app).post("/api/classes").set(A(ttk)).send({ name_en: "Default", name_fa: "پ" });
    const detail = await request(app).get(`/api/classes/${created.body.id}`).set(A(ttk));
    expect(detail.body.class.log_transcript).toBe(1);
  });

  it("with logging off: score is stored, transcript is NOT", async () => {
    const ttk = await token("teacher");
    const stuId = ((await request(app).get("/api/users").set(A(ttk))).body).find((u) => u.username === "40012345").id;
    const cid = await makeClass(ttk, stuId, 1, { logTranscript: false });
    const stk = await token("40012345");

    const sess = await request(app).post("/api/exam/session-start").set(A(stk))
      .send({ caseId: 1, classId: cid, lang: "fa" });
    expect(sess.status).toBe(200);
    expect(sess.body.loggingEnabled).toBe(false);   // server made the privacy decision

    const ev = await request(app).post("/api/exam/evaluate").set(A(stk))
      .send({ caseId: 1, classId: cid, lang: "fa", durationSec: 300,
              sessionId: sess.body.sessionId, events: vpEvents, session: vpSession });
    expect(ev.status).toBe(200);
    expect(typeof ev.body.score).toBe("number");     // grading still works
    expect(ev.body.logging.enabled).toBe(false);
    expect(ev.body.logging.eventsStored).toBe(0);

    // The transcript column is genuinely NULL — not an empty object.
    const row = db.prepare("SELECT transcript_json FROM attempts WHERE id=?").get(ev.body.attemptId);
    expect(row.transcript_json).toBeNull();
    // …and no event rows leaked into the log table either.
    expect(db.prepare("SELECT COUNT(*) n FROM vp_session_events WHERE session_id=?").get(sess.body.sessionId).n).toBe(0);
    // The session row still exists, so the encounter itself is countable.
    expect(db.prepare("SELECT logging_enabled FROM vp_sessions WHERE id=?").get(sess.body.sessionId).logging_enabled).toBe(0);
  });

  it("with logging on: the transcript and every timestamped event are stored", async () => {
    const ttk = await token("teacher");
    const stuId = ((await request(app).get("/api/users").set(A(ttk))).body).find((u) => u.username === "40012345").id;
    const cid = await makeClass(ttk, stuId, 1, { logTranscript: true });
    const stk = await token("40012345");

    const sess = await request(app).post("/api/exam/session-start").set(A(stk))
      .send({ caseId: 1, classId: cid, lang: "fa" });
    expect(sess.body.loggingEnabled).toBe(true);

    const ev = await request(app).post("/api/exam/evaluate").set(A(stk))
      .send({ caseId: 1, classId: cid, lang: "fa", durationSec: 300,
              sessionId: sess.body.sessionId, events: vpEvents, session: vpSession });
    expect(ev.body.logging.enabled).toBe(true);
    expect(ev.body.logging.eventsStored).toBe(vpEvents.length);

    const row = db.prepare("SELECT transcript_json FROM attempts WHERE id=?").get(ev.body.attemptId);
    expect(JSON.parse(row.transcript_json).messages.length).toBe(2);

    const log = await request(app).get(`/api/classes/${cid}/attempts/${ev.body.attemptId}/session-log`).set(A(ttk));
    expect(log.status).toBe(200);
    expect(log.body.loggingEnabled).toBe(true);
    const kinds = log.body.sessions[0].events.map((e) => e.kind);
    expect(kinds).toEqual(["student_msg", "patient_msg", "lab_order", "lab_result", "imaging_order", "ddx_add", "final_dx", "finish"]);
    // Timestamps survive, so the analysis can reconstruct the process.
    expect(log.body.sessions[0].events[1].atMs).toBe(2500);
    expect(log.body.sessions[0].events[1].source).toBe("mock");
    expect(log.body.sessions[0].events[3].found).toBe(true);
  });

  it("toggling the switch does not rewrite sessions already recorded", async () => {
    const ttk = await token("teacher");
    const stuId = ((await request(app).get("/api/users").set(A(ttk))).body).find((u) => u.username === "40012345").id;
    const cid = await makeClass(ttk, stuId, 1, { logTranscript: false });
    const stk = await token("40012345");
    const sess = await request(app).post("/api/exam/session-start").set(A(stk)).send({ caseId: 1, classId: cid });
    const ev = await request(app).post("/api/exam/evaluate").set(A(stk))
      .send({ caseId: 1, classId: cid, lang: "fa", durationSec: 60, sessionId: sess.body.sessionId, events: vpEvents, session: vpSession });

    // Teacher flips logging ON afterwards.
    await request(app).put(`/api/classes/${cid}`).set(A(ttk))
      .send({ name_en: "Log x", name_fa: "لاگ", maxAttempts: 5, logTranscript: true });

    const row = db.prepare("SELECT transcript_json FROM attempts WHERE id=?").get(ev.body.attemptId);
    expect(row.transcript_json).toBeNull();      // still nothing — the snapshot held
    expect(db.prepare("SELECT logging_enabled FROM vp_sessions WHERE id=?").get(sess.body.sessionId).logging_enabled).toBe(0);
  });

  it("omitting the switch on update keeps the stored value (no silent flip)", async () => {
    const ttk = await token("teacher");
    const cid = (await request(app).post("/api/classes").set(A(ttk))
      .send({ name_en: "Keep", name_fa: "ک", logTranscript: true })).body.id;
    // An update that never mentions logging must not turn it off…
    await request(app).put(`/api/classes/${cid}`).set(A(ttk)).send({ name_en: "Keep2", name_fa: "ک۲", maxAttempts: 2 });
    expect((await request(app).get(`/api/classes/${cid}`).set(A(ttk))).body.class.log_transcript).toBe(1);
    // …and the same request must not silently switch the live board ON either
    // (the old `liveBoardEnabled === false ? 0 : 1` did exactly that).
    await request(app).put(`/api/classes/${cid}`).set(A(ttk)).send({ name_en: "Keep3", name_fa: "ک۳", liveBoardEnabled: false });
    const after = (await request(app).get(`/api/classes/${cid}`).set(A(ttk))).body.class;
    expect(after.live_board_enabled).toBe(0);
    expect(after.log_transcript).toBe(1);
  });
});

describe("the logged data is validated before it is trusted", () => {
  it("drops unknown event kinds, blank text and oversized payloads", async () => {
    const ttk = await token("teacher");
    const stuId = ((await request(app).get("/api/users").set(A(ttk))).body).find((u) => u.username === "40012345").id;
    const cid = await makeClass(ttk, stuId, 1, { logTranscript: true });
    const stk = await token("40012345");
    const sess = await request(app).post("/api/exam/session-start").set(A(stk)).send({ caseId: 1, classId: cid });

    const dirty = [
      { kind: "student_msg", atMs: 10, text: "real message" },
      { kind: "admin_grant_token", atMs: 20, text: "injection" },  // not a whitelisted kind
      { kind: "student_msg", atMs: 30, text: "   " },              // blank
      { kind: "student_msg", atMs: 40, text: "x".repeat(9000) },   // over the per-message cap
      { kind: "lab_order", atMs: 50, query: "ecg" },               // valid
      null,                                                        // junk
    ];
    const ev = await request(app).post("/api/exam/evaluate").set(A(stk))
      .send({ caseId: 1, classId: cid, lang: "fa", durationSec: 60, sessionId: sess.body.sessionId, events: dirty, session: vpSession });
    expect(ev.status).toBe(200);
    // Three are usable. The 9000-char message is kept but CLIPPED — losing a
    // whole turn to a length cap would silently corrupt the study data.
    expect(ev.body.logging.eventsStored).toBe(3);
    expect(ev.body.logging.eventsDropped).toBe(3);     // unknown kind, blank, junk

    const log = await request(app).get(`/api/classes/${cid}/attempts/${ev.body.attemptId}/session-log`).set(A(ttk));
    const kinds = log.body.sessions[0].events.map((e) => e.kind);
    expect(kinds).toEqual(["student_msg", "student_msg", "lab_order"]);
    expect(log.body.sessions[0].events[0].text).toBe("real message");
    expect(log.body.sessions[0].events[1].text.length).toBe(4000);   // MAX_TEXT
    // A whitelist is the second line of defence; SQL-like payloads are already
    // refused one layer up by the global input filter, before reaching the route.
    const inject = await request(app).post("/api/exam/evaluate").set(A(stk))
      .send({ caseId: 1, classId: cid, lang: "fa", durationSec: 60, session: vpSession,
              events: [{ kind: "student_msg", atMs: 1, text: "'; DROP TABLE users; --" }] });
    expect(inject.status).toBe(400);
    expect(inject.body.error).toBe("suspicious_input");
  });

  it("a student cannot close or read someone else's session", async () => {
    const ttk = await token("teacher");
    const ali = ((await request(app).get("/api/users").set(A(ttk))).body).find((u) => u.username === "40012345").id;
    const maryam = ((await request(app).get("/api/users").set(A(ttk))).body).find((u) => u.username === "40067890").id;
    const cid = await makeClass(ttk, ali, 1, { logTranscript: true });
    await request(app).put(`/api/classes/${cid}/members`).set(A(ttk)).send({ userIds: [ali, maryam] });

    const atk = await token("40012345");
    const sess = await request(app).post("/api/exam/session-start").set(A(atk)).send({ caseId: 1, classId: cid });

    const mtk = await token("40067890");
    const hijack = await request(app).post("/api/exam/session-abandon").set(A(mtk))
      .send({ sessionId: sess.body.sessionId, events: [{ kind: "student_msg", atMs: 1, text: "not mine" }] });
    expect(hijack.status).toBe(403);
    expect(db.prepare("SELECT COUNT(*) n FROM vp_session_events WHERE session_id=?").get(sess.body.sessionId).n).toBe(0);

    // …and a student may not read the class log endpoints at all.
    const read = await request(app).get(`/api/classes/${cid}/conversation-log.csv`).set(A(atk));
    expect(read.status).toBe(403);
  });

  it("an abandoned session is still closed and keeps its partial log", async () => {
    const ttk = await token("teacher");
    const stuId = ((await request(app).get("/api/users").set(A(ttk))).body).find((u) => u.username === "40012345").id;
    const cid = await makeClass(ttk, stuId, 1, { logTranscript: true });
    const stk = await token("40012345");
    const sess = await request(app).post("/api/exam/session-start").set(A(stk)).send({ caseId: 1, classId: cid });

    const res = await request(app).post("/api/exam/session-abandon").set(A(stk))
      .send({ sessionId: sess.body.sessionId, events: vpEvents.slice(0, 3) });
    expect(res.status).toBe(200);
    expect(res.body.stored).toBe(3);
    const row = db.prepare("SELECT finished_at, attempt_id FROM vp_sessions WHERE id=?").get(sess.body.sessionId);
    expect(row.finished_at).toBeTruthy();
    expect(row.attempt_id).toBeNull();     // never graded — it is a dropout record
  });
});

describe("the conversation log is exportable for analysis", () => {
  it("exports one CSV row per event when logging is on", async () => {
    const ttk = await token("teacher");
    const stuId = ((await request(app).get("/api/users").set(A(ttk))).body).find((u) => u.username === "40012345").id;
    const cid = await makeClass(ttk, stuId, 1, { logTranscript: true });
    const stk = await token("40012345");
    const sess = await request(app).post("/api/exam/session-start").set(A(stk)).send({ caseId: 1, classId: cid });
    await request(app).post("/api/exam/evaluate").set(A(stk))
      .send({ caseId: 1, classId: cid, lang: "fa", durationSec: 60, sessionId: sess.body.sessionId, events: vpEvents, session: vpSession });

    const csv = await request(app).get(`/api/classes/${cid}/conversation-log.csv`).set(A(ttk));
    expect(csv.status).toBe(200);
    expect(csv.headers["content-type"]).toContain("text/csv");
    const lines = csv.text.replace(/^\uFEFF/, "").trim().split("\n");
    expect(lines[0]).toBe("session_id,user_id,student_no,case_id,attempt_id,seq,at_ms,kind,text,detail,started_at");
    expect(lines.length).toBe(1 + vpEvents.length);
    expect(lines[1]).toContain("student_msg");
    expect(csv.text).toContain("درد قفسه سینه");       // Persian survives the export
  });

  it("refuses the export when logging is off (409, not an empty file)", async () => {
    const ttk = await token("teacher");
    const stuId = ((await request(app).get("/api/users").set(A(ttk))).body).find((u) => u.username === "40012345").id;
    const cid = await makeClass(ttk, stuId, 1, { logTranscript: false });
    const csv = await request(app).get(`/api/classes/${cid}/conversation-log.csv`).set(A(ttk));
    expect(csv.status).toBe(409);
    expect(csv.body.error).toBe("logging_disabled");
  });

  it("keeps exporting historical logs after the teacher later turns logging off", async () => {
    const ttk = await token("teacher");
    const stuId = ((await request(app).get("/api/users").set(A(ttk))).body).find((u) => u.username === "40022334").id;
    const cid = await makeClass(ttk, stuId, 1, { logTranscript: true });
    const stk = await token("40022334");
    const sess = await request(app).post("/api/exam/session-start").set(A(stk)).send({ caseId: 1, classId: cid });
    await request(app).post("/api/exam/evaluate").set(A(stk))
      .send({ caseId: 1, classId: cid, lang: "fa", durationSec: 40, sessionId: sess.body.sessionId, events: vpEvents, session: vpSession });
    const off = await request(app).put(`/api/classes/${cid}`).set(A(ttk))
      .send({ name_fa: "لاگ", name_en: "Log", maxAttempts: 5, logTranscript: false });
    expect(off.status).toBe(200);
    const csv = await request(app).get(`/api/classes/${cid}/conversation-log.csv`).set(A(ttk));
    expect(csv.status).toBe(200);
    expect(csv.text).toContain("student_msg");
  });

  it("stores consent_granted, ddx_remove and teacher_msg events", async () => {
    const ttk = await token("teacher");
    const stuId = ((await request(app).get("/api/users").set(A(ttk))).body).find((u) => u.username === "40067890").id;
    const cid = await makeClass(ttk, stuId, 1, { logTranscript: true });
    const stk = await token("40067890");
    const sess = await request(app).post("/api/exam/session-start").set(A(stk)).send({ caseId: 1, classId: cid });
    const extra = [
      { kind: "consent_granted", atMs: 5, studyId: 1 },
      { kind: "ddx_add", atMs: 20, text: "ACS" },
      { kind: "ddx_remove", atMs: 30, text: "ACS" },
      { kind: "teacher_msg", atMs: 40, text: "یافته‌های معاینه", source: "mock" },
      { kind: "finish", atMs: 50 },
    ];
    const ev = await request(app).post("/api/exam/evaluate").set(A(stk))
      .send({ caseId: 1, classId: cid, lang: "fa", durationSec: 20, sessionId: sess.body.sessionId, events: extra, session: vpSession });
    expect(ev.status).toBe(200);
    expect(ev.body.logging.eventsStored).toBe(extra.length);
    const log = await request(app).get(`/api/classes/${cid}/attempts/${ev.body.attemptId}/session-log`).set(A(ttk));
    expect(log.status).toBe(200);
    const kinds = (log.body.sessions || []).flatMap((s) => (s.events || []).map((e) => e.kind));
    expect(kinds).toEqual(expect.arrayContaining(["consent_granted", "ddx_remove", "teacher_msg"]));
  });
});

describe("server-side timing", () => {
  it("records a server-measured duration alongside the client's", async () => {
    const ttk = await token("teacher");
    const stuId = ((await request(app).get("/api/users").set(A(ttk))).body).find((u) => u.username === "40012345").id;
    const cid = await makeClass(ttk, stuId, 1, { logTranscript: true });
    const stk = await token("40012345");
    const sess = await request(app).post("/api/exam/session-start").set(A(stk)).send({ caseId: 1, classId: cid });
    // The client claims 2 hours; the session only existed for a moment, so the
    // server-measured value must win.
    const ev = await request(app).post("/api/exam/evaluate").set(A(stk))
      .send({ caseId: 1, classId: cid, lang: "fa", durationSec: 7200, sessionId: sess.body.sessionId, events: vpEvents, session: vpSession });
    expect(ev.status).toBe(200);
    expect(ev.body.meta.durationSecClient).toBe(7200);
    expect(ev.body.meta.durationSecServer).toBeLessThan(120);
    expect(ev.body.meta.durationSecRecorded).toBeLessThan(120);
    const row = db.prepare("SELECT duration_sec FROM attempts WHERE id=?").get(ev.body.attemptId);
    expect(row.duration_sec).toBeLessThan(120);
  });
});

describe("saved-conversation inbox + research link", () => {
  it("lists class VP attempts for the teacher", async () => {
    const ttk = await token("teacher");
    const stuId = ((await request(app).get("/api/users").set(A(ttk))).body).find((u) => u.username === "40012345").id;
    const cid = await makeClass(ttk, stuId, 1, { logTranscript: true });
    const stk = await token("40012345");
    const sess = await request(app).post("/api/exam/session-start").set(A(stk)).send({ caseId: 1, classId: cid, lang: "fa" });
    const ev = await request(app).post("/api/exam/evaluate").set(A(stk))
      .send({ caseId: 1, classId: cid, lang: "fa", durationSec: 40, sessionId: sess.body.sessionId, events: vpEvents, session: vpSession });
    expect(ev.status).toBe(200);
    const inbox = await request(app).get("/api/classes/conversations").set(A(ttk));
    expect(inbox.status).toBe(200);
    expect(inbox.body.attempts.some((a) => a.id === ev.body.attemptId)).toBe(true);
    const row = inbox.body.attempts.find((a) => a.id === ev.body.attemptId);
    expect(row.has_transcript).toBe(true);
  });

  it("lets a teacher create a study and attach it to a class", async () => {
    const ttk = await token("teacher");
    const study = await request(app).post("/api/research/studies").set(A(ttk)).send({
      title_fa: "مطالعه کلاس", title_en: "Class study", domain: "education",
      active: true, consent_required: false, consent_text_fa: "متن رضایت",
    });
    expect(study.status).toBe(200);
    expect(study.body.id).toBeTruthy();
    const created = await request(app).post("/api/classes").set(A(ttk))
      .send({ name_en: "Linked", name_fa: "وصل", studyId: study.body.id, logTranscript: true });
    expect(created.status).toBe(200);
    const detail = await request(app).get(`/api/classes/${created.body.id}`).set(A(ttk));
    expect(detail.status).toBe(200);
    expect(detail.body.class.study_id).toBe(study.body.id);
  });
});
