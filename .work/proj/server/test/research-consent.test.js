/* ================================================================
   research-consent.test.js — Phase 3: informed consent.

   The rule under test: `research_studies.consent_required` must actually stop
   someone from taking part. It has existed in the schema from the start and was
   never enforced, which meant a study could collect data from participants with
   no record that they agreed. These tests pin the enforcement, the multiple
   collection modes (including paper consent recorded by a researcher), and the
   auditability of what wording each person agreed to.
   ================================================================ */
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import request from "supertest";
import { initDb, db } from "../src/db.js";
import { createApp } from "../src/app.js";
import { consentTextHash, parseModes } from "../src/lib/consent.js";

let app;
async function token(u, p = "demo") {
  return (await request(app).post("/api/auth/login").send({ username: u, password: p })).body.token;
}
const A = (tk) => ({ Authorization: `Bearer ${tk}` });
const uid = async (tk, username) =>
  ((await request(app).get("/api/users").set(A(tk))).body).find((u) => u.username === username).id;

const CONSENT_TEXT_FA = "این پژوهش گفت‌وگوی شما با بیمار مجازی را ضبط می‌کند. شرکت اختیاری است و هر زمان می‌توانید انصراف دهید.";

async function makeStudy(tk, patch = {}) {
  const res = await request(app).post("/api/research/studies").set(A(tk)).send({
    title_fa: "ارزیابی شبیه‌ساز بالینی", title_en: "Clinical simulator evaluation",
    domain: "education", active: true, consent_required: true,
    ethics_code: "IR.ARUMS.REC.1404.118", protocol_version: "v1.0",
    consent_text_fa: CONSENT_TEXT_FA, consent_text_en: "This study records your conversation.",
    consent_modes: "online,paper,verbal", ...patch,
  });
  // Legacy online-gate scenarios explicitly opt in; default is now admin-managed.
  db.prepare("UPDATE research_studies SET consent_admin_managed=0 WHERE id=?").run(res.body.id);
  return res.body;
}

async function makeClass(tk, stuId, caseId, studyId) {
  const cid = (await request(app).post("/api/classes").set(A(tk))
    .send({ name_en: `Study ${Math.random()}`, name_fa: "مطالعه", maxAttempts: 5, studyId })).body.id;
  await request(app).put(`/api/classes/${cid}/members`).set(A(tk)).send({ userIds: [stuId] });
  await request(app).put(`/api/classes/${cid}/cases`).set(A(tk)).send({ cases: [{ case_id: caseId, weight: 1 }] });
  return cid;
}

beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb();
  app = createApp();
});

describe("the consent gate actually blocks participation", () => {
  it("a student in a consent-required study cannot start a session", async () => {
    const ttk = await token("teacher");
    const study = await makeStudy(ttk);
    const stuId = await uid(ttk, "40012345");
    const cid = await makeClass(ttk, stuId, 1, study.id);
    const stk = await token("40012345");

    const start = await request(app).post("/api/exam/session-start").set(A(stk)).send({ caseId: 1, classId: cid });
    expect(start.status).toBe(403);
    expect(start.body.reason).toBe("consent_required");
    expect(start.body.stage).toBe("consent");
    expect(start.body.studyId).toBe(study.id);        // so the client can open the consent screen
    expect(start.body.consentTextFa).toContain("ضبط می‌کند");
    expect(start.body.ethicsCode).toBe("IR.ARUMS.REC.1404.118");

    // Every other entry point refuses too.
    for (const path of ["/api/exam/patient-reply", "/api/exam/order", "/api/exam/evaluate"]) {
      const r = await request(app).post(path).set(A(stk))
        .send({ caseId: 1, classId: cid, lang: "fa", session: { messages: [], tests: [], imaging: [], ddx: [], finalDx: "" } });
      expect(r.status, path).toBe(403);
      expect(r.body.reason, path).toBe("consent_required");
    }
    // And nothing was recorded.
    expect(db.prepare("SELECT COUNT(*) n FROM vp_sessions WHERE class_id=?").get(cid).n).toBe(0);
  });

  it("after consenting online, the same student gets in", async () => {
    const ttk = await token("teacher");
    const study = await makeStudy(ttk);
    const stuId = await uid(ttk, "40012345");
    const cid = await makeClass(ttk, stuId, 1, study.id);
    const stk = await token("40012345");

    const before = await request(app).get(`/api/research/consent/status?classId=${cid}`).set(A(stk));
    expect(before.body.required).toBe(true);
    expect(before.body.granted).toBe(false);
    expect(before.body.ethicsCode).toBe("IR.ARUMS.REC.1404.118");
    expect(before.body.protocolVersion).toBe("v1.0");
    expect(before.body.consentTextFa).toContain("ضبط می‌کند");

    const grant = await request(app).post("/api/research/consent").set(A(stk)).send({ study_id: study.id });
    expect(grant.status).toBe(200);
    expect(grant.body.status).toBe("granted");

    const after = await request(app).get(`/api/research/consent/status?classId=${cid}`).set(A(stk));
    expect(after.body.granted).toBe(true);

    const start = await request(app).post("/api/exam/session-start").set(A(stk)).send({ caseId: 1, classId: cid });
    expect(start.status).toBe(200);
    // The session is attributed to the protocol it belongs to.
    expect(db.prepare("SELECT study_id FROM vp_sessions WHERE id=?").get(start.body.sessionId).study_id).toBe(study.id);
  });

  it("an inactive study does not block teaching, and no study means no gate", async () => {
    const ttk = await token("teacher");
    const study = await makeStudy(ttk, { active: false });
    const stuId = await uid(ttk, "40012345");
    const cid = await makeClass(ttk, stuId, 1, study.id);
    const stk = await token("40012345");
    const r = await request(app).post("/api/exam/session-start").set(A(stk)).send({ caseId: 1, classId: cid });
    expect(r.status).toBe(200);

    // A class with no study at all is unaffected.
    const plain = await makeClass(ttk, stuId, 1, null);
    const r2 = await request(app).post("/api/exam/session-start").set(A(stk)).send({ caseId: 1, classId: plain });
    expect(r2.status).toBe(200);
  });

  it("consent_required=false does not gate, even when the study is active", async () => {
    const ttk = await token("teacher");
    const study = await makeStudy(ttk, { consent_required: false });
    const stuId = await uid(ttk, "40012345");
    const cid = await makeClass(ttk, stuId, 1, study.id);
    const stk = await token("40012345");
    expect((await request(app).post("/api/exam/session-start").set(A(stk)).send({ caseId: 1, classId: cid })).status).toBe(200);
  });

  it("a teacher is not a participant and is never gated", async () => {
    const ttk = await token("teacher");
    const study = await makeStudy(ttk);
    const cid = await makeClass(ttk, await uid(ttk, "40012345"), 1, study.id);
    const r = await request(app).post("/api/exam/session-start").set(A(ttk)).send({ caseId: 1, classId: cid });
    expect(r.status).toBe(200);
  });

  it("the event ingest refuses data from a participant who has not consented", async () => {
    const ttk = await token("teacher");
    const study = await makeStudy(ttk);
    const stuId = await uid(ttk, "40012345");
    await makeClass(ttk, stuId, 1, study.id);
    const stk = await token("40012345");
    const denied = await request(app).post("/api/research/event").set(A(stk))
      .send({ study_id: study.id, event_type: "session_started", context_type: "study" });
    expect(denied.status).toBe(403);
    expect(denied.body.error).toBe("consent_required");

    await request(app).post("/api/research/consent").set(A(stk)).send({ study_id: study.id });
    const ok = await request(app).post("/api/research/event").set(A(stk))
      .send({ study_id: study.id, event_type: "session_started", context_type: "study" });
    expect(ok.status).toBe(200);
  });
});

describe("consent can be collected on paper by a researcher", () => {
  it("records a paper consent with the researcher and a note identifying the form", async () => {
    const ttk = await token("teacher");
    const study = await makeStudy(ttk);
    const stuId = await uid(ttk, "40012345");
    await makeClass(ttk, stuId, 1, study.id);
    const stk = await token("40012345");

    // Blocked before the researcher files the signed form.
    expect((await request(app).get(`/api/research/consent/status?studyId=${study.id}`).set(A(stk))).body.granted).toBe(false);

    const rec = await request(app).post(`/api/research/studies/${study.id}/consents/record`).set(A(ttk))
      .send({ user_id: stuId, mode: "paper", note: "فرم امضاشدهٔ شمارهٔ ۱۲ — بخش CCU، ۱۴۰۴/۰۶/۱۸" });
    expect(rec.status).toBe(200);
    expect(rec.body.mode).toBe("paper");

    expect((await request(app).get(`/api/research/consent/status?studyId=${study.id}`).set(A(stk))).body.granted).toBe(true);

    const roster = await request(app).get(`/api/research/studies/${study.id}/consents`).set(A(ttk));
    expect(roster.body.counts.granted).toBe(1);
    expect(roster.body.counts.byMode.paper).toBe(1);
    expect(roster.body.consents[0].recorder).toBeTruthy();
    expect(roster.body.consents[0].note).toContain("فرم امضاشده");
    expect(roster.body.consents[0].protocolVersion).toBe("v1.0");
  });

  it("a note is mandatory — the row is the only evidence the consent exists", async () => {
    const ttk = await token("teacher");
    const study = await makeStudy(ttk);
    const stuId = await uid(ttk, "40012345");
    const r = await request(app).post(`/api/research/studies/${study.id}/consents/record`).set(A(ttk))
      .send({ user_id: stuId, mode: "paper" });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("note_required");
  });

  it("a mode the protocol does not permit cannot be recorded", async () => {
    const ttk = await token("teacher");
    const study = await makeStudy(ttk, { consent_modes: "online,paper" });   // no verbal
    const stuId = await uid(ttk, "40012345");
    const r = await request(app).post(`/api/research/studies/${study.id}/consents/record`).set(A(ttk))
      .send({ user_id: stuId, mode: "verbal", note: "تلفنی" });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("consent_mode_not_permitted");
  });

  it("a researcher cannot file an 'online' consent — that one must be self-granted", async () => {
    const ttk = await token("teacher");
    const study = await makeStudy(ttk);
    const stuId = await uid(ttk, "40012345");
    const r = await request(app).post(`/api/research/studies/${study.id}/consents/record`).set(A(ttk))
      .send({ user_id: stuId, mode: "online", note: "خودش زد" });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("online_consent_must_be_self_granted");
  });

  it("an unknown mode and an unknown study are rejected", async () => {
    const ttk = await token("teacher");
    const study = await makeStudy(ttk);
    const stuId = await uid(ttk, "40012345");
    const bad = await request(app).post(`/api/research/studies/${study.id}/consents/record`).set(A(ttk))
      .send({ user_id: stuId, mode: "telepathy", note: "x" });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe("unknown_consent_mode");

    const noStudy = await request(app).post("/api/research/studies/999999/consents/record").set(A(ttk))
      .send({ user_id: stuId, mode: "paper", note: "x" });
    expect(noStudy.status).toBe(404);
  });

  it("consent with no wording on file cannot be granted at all", async () => {
    const ttk = await token("teacher");
    const study = await makeStudy(ttk, { consent_text_fa: "", consent_text_en: "" });
    const stuId = await uid(ttk, "40012345");
    await makeClass(ttk, stuId, 1, study.id);
    const stk = await token("40012345");
    const r = await request(app).post("/api/research/consent").set(A(stk)).send({ study_id: study.id });
    expect(r.status).toBe(409);
    expect(r.body.error).toBe("consent_text_missing");
    // Recording consent to an empty document would be worse than recording none.
    expect(db.prepare("SELECT COUNT(*) n FROM research_consents WHERE study_id=?").get(study.id).n).toBe(0);
  });

  it("a student cannot read the roster or record consents", async () => {
    const ttk = await token("teacher");
    const study = await makeStudy(ttk);
    const stk = await token("40012345");
    expect((await request(app).get(`/api/research/studies/${study.id}/consents`).set(A(stk))).status).toBe(403);
    expect((await request(app).post(`/api/research/studies/${study.id}/consents/record`).set(A(stk))
      .send({ user_id: 3, mode: "paper", note: "خودم" })).status).toBe(403);
  });
});

describe("withdrawal and the audit trail", () => {
  it("a request does not block collection until an admin explicitly pauses participation", async () => {
    const ttk = await token("teacher");
    const study = await makeStudy(ttk);
    const stuId = await uid(ttk, "40012345");
    const cid = await makeClass(ttk, stuId, 1, study.id);
    const stk = await token("40012345");

    await request(app).post("/api/research/consent").set(A(stk)).send({ study_id: study.id });
    expect((await request(app).post("/api/exam/session-start").set(A(stk)).send({ caseId: 1, classId: cid })).status).toBe(200);

    const w = await request(app).post("/api/research/consent/withdraw").set(A(stk))
      .send({ study_id: study.id, note: "دیگر مایل نیستم" });
    expect(w.status).toBe(202);
    expect(w.body.collectionPaused).toBe(false);
    expect((await request(app).get(`/api/research/consent/status?classId=${cid}`).set(A(stk))).body.granted).toBe(true);
    const atk=await token("admin");
    expect((await request(app).post(`/api/research/studies/${study.id}/participation`).set(A(atk)).send({user_id:stuId,blocked:true,note:"In-person withdrawal"})).status).toBe(200);

    const st = await request(app).get(`/api/research/consent/status?classId=${cid}`).set(A(stk));
    expect(st.body.granted).toBe(false);
    expect(st.body.reason).toBe("research_paused");   // distinct from "never asked"

    const blocked = await request(app).post("/api/exam/session-start").set(A(stk)).send({ caseId: 1, classId: cid });
    expect(blocked.status).toBe(403);
    expect(blocked.body.reason).toBe("research_paused");

    // The row still exists — the fact of withdrawal is itself study data.
    const row = db.prepare("SELECT status, withdrawn_at, granted_at FROM research_consents WHERE study_id=? AND user_id=?").get(study.id, stuId);
    expect(row.status).toBe("granted"); // consent evidence preserved separately from admin collection hold
    expect(row.withdrawn_at).toBeNull();
    expect(row.granted_at).toBeTruthy();
    // And no further events can be filed.
    expect((await request(app).post("/api/research/event").set(A(stk))
      .send({ study_id: study.id, event_type: "session_finished", context_type: "study" })).status).toBe(403);
  });

  it("a withdrawal request preserves the consent evidence without duplicating rows", async () => {
    const ttk = await token("teacher");
    const study = await makeStudy(ttk);
    const stuId = await uid(ttk, "40012345");
    await makeClass(ttk, stuId, 1, study.id);
    const stk = await token("40012345");
    await request(app).post("/api/research/consent").set(A(stk)).send({ study_id: study.id });
    await request(app).post("/api/research/consent/withdraw").set(A(stk)).send({ study_id: study.id });
    await request(app).post("/api/research/consent").set(A(stk)).send({ study_id: study.id });

    const row = db.prepare("SELECT status, withdrawn_at FROM research_consents WHERE study_id=? AND user_id=?").get(study.id, stuId);
    expect(row.status).toBe("granted");
    expect(row.withdrawn_at).toBeNull();
    // Still exactly one row — a participant has one live decision, not a pile.
    expect(db.prepare("SELECT COUNT(*) n FROM research_consents WHERE study_id=? AND user_id=?").get(study.id, stuId).n).toBe(1);
  });

  it("consent is fingerprinted against the exact wording, and going stale is visible", async () => {
    const ttk = await token("teacher");
    const study = await makeStudy(ttk);
    const stuId = await uid(ttk, "40012345");
    await makeClass(ttk, stuId, 1, study.id);
    const stk = await token("40012345");
    await request(app).post("/api/research/consent").set(A(stk)).send({ study_id: study.id });

    const expected = consentTextHash(CONSENT_TEXT_FA, "v1.0");
    const row = db.prepare("SELECT consent_text_hash FROM research_consents WHERE study_id=? AND user_id=?").get(study.id, stuId);
    expect(row.consent_text_hash).toBe(expected);
    expect(consentTextHash(CONSENT_TEXT_FA, "v1.0")).toBe(expected);            // stable
    expect(consentTextHash(CONSENT_TEXT_FA, "v2.0")).not.toBe(expected);        // version matters
    expect(consentTextHash(CONSENT_TEXT_FA + " یک جملهٔ دیگر", "v1.0")).not.toBe(expected);  // wording matters

    // Amend the protocol: the existing consent must now be flagged stale rather
    // than silently treated as covering the new terms.
    await request(app).put(`/api/research/studies/${study.id}`).set(A(ttk)).send({ protocol_version: "v2.0" });
    const roster = await request(app).get(`/api/research/studies/${study.id}/consents`).set(A(ttk));
    expect(roster.body.counts.stale).toBe(1);
    expect(roster.body.consents[0].stale).toBe(true);
    expect((await request(app).get(`/api/research/consent/status?studyId=${study.id}`).set(A(stk))).body.stale).toBe(true);
  });

  it("every consent action is audited", async () => {
    const ttk = await token("teacher");
    const study = await makeStudy(ttk);
    const stuId = await uid(ttk, "40012345");
    await request(app).post(`/api/research/studies/${study.id}/consents/record`).set(A(ttk))
      .send({ user_id: stuId, mode: "paper", note: "فرم ۱" });
    const acts = db.prepare("SELECT action FROM audit_log ORDER BY id DESC LIMIT 12").all().map((x) => x.action);
    expect(acts).toContain("research.consent_recorded");
    expect(acts).toContain("research.study_create");
  });
});

describe("de-identified export", () => {
  it("anonymised export carries the pseudonym and drops the identifiers", async () => {
    const ttk = await token("teacher");
    const study = await makeStudy(ttk);
    const stuId = await uid(ttk, "40012345");
    await request(app).post(`/api/research/studies/${study.id}/consents/record`).set(A(ttk))
      .send({ user_id: stuId, mode: "paper", note: "فرم ۱" });

    const named = await request(app).get(`/api/research/studies/${study.id}/consents`).set(A(ttk));
    expect(named.body.study.anonymized).toBe(false);
    expect(named.body.consents[0].studentNo).toBe("40012345");
    expect(named.body.consents[0].userId).toBe(stuId);

    const anon = await request(app).get(`/api/research/studies/${study.id}/consents?anonymize=1`).set(A(ttk));
    expect(anon.body.consents[0].studentNo).toBe("");
    expect(anon.body.consents[0].participantName).toBe("");
    expect(anon.body.consents[0].userId).toBeNull();
    expect(anon.body.consents[0].pseudonym).toMatch(/^[0-9a-f]{16}$/);

    // The study-level switch does the same without asking per request.
    await request(app).put(`/api/research/studies/${study.id}`).set(A(ttk)).send({ anonymize: true });
    const csv = await request(app).get(`/api/research/studies/${study.id}/consents.csv`).set(A(ttk));
    expect(csv.status).toBe(200);
    expect(csv.headers["content-type"]).toContain("text/csv");
    const lines = csv.text.replace(/^\uFEFF/, "").trim().split("\n");
    expect(lines[0]).toBe("pseudonym,student_no,participant,mode,status,protocol_version,consent_text_hash,stale,recorded_by,note,granted_at,withdrawn_at");
    expect(lines.length).toBe(2);
    expect(lines[1]).not.toContain("40012345");
    expect(lines[1]).toContain("paper");
    expect(lines[1]).toContain("فرم ۱");
  });
});

describe("study configuration", () => {
  it("defaults: admin-managed, all collection methods, anonymisation OFF", async () => {
    const ttk = await token("teacher");
    const study = await makeStudy(ttk, { consent_modes: undefined, anonymize: undefined });
    expect(study.consent_required).toBe(true);
    expect(parseModes(study.consent_modes)).toEqual(["online", "paper", "verbal"]);
    expect(study.consent_admin_managed).toBe(true);
    expect(study.anonymize).toBe(false);
  });

  it("an update that omits a field keeps the stored value", async () => {
    const ttk = await token("teacher");
    const study = await makeStudy(ttk);
    // Only the title is sent — everything else must survive.
    const res = await request(app).put(`/api/research/studies/${study.id}`).set(A(ttk)).send({ title_fa: "عنوان تازه" });
    expect(res.body.title_fa).toBe("عنوان تازه");
    expect(res.body.ethics_code).toBe("IR.ARUMS.REC.1404.118");
    expect(res.body.protocol_version).toBe("v1.0");
    expect(parseModes(res.body.consent_modes)).toEqual(["online", "paper", "verbal"]);
    expect(res.body.consent_required).toBe(true);
  });

  it("a class can be enrolled in and withdrawn from a study", async () => {
    const ttk = await token("teacher");
    const study = await makeStudy(ttk);
    const stuId = await uid(ttk, "40012345");
    const cid = (await request(app).post("/api/classes").set(A(ttk)).send({ name_en: "c", name_fa: "ک" })).body.id;
    expect((await request(app).get(`/api/classes/${cid}`).set(A(ttk))).body.class.study_id).toBeNull();

    await request(app).put(`/api/classes/${cid}/members`).set(A(ttk)).send({ userIds: [stuId] });
    await request(app).put(`/api/classes/${cid}/cases`).set(A(ttk)).send({ cases: [{ case_id: 1, weight: 1 }] });
    await request(app).put(`/api/classes/${cid}`).set(A(ttk))
      .send({ name_fa: "ک", name_en: "c", maxAttempts: 5, studyId: study.id });
    expect((await request(app).get(`/api/classes/${cid}`).set(A(ttk))).body.class.study_id).toBe(study.id);

    // Enrolling is what activates the gate.
    const stk = await token("40012345");
    expect((await request(app).post("/api/exam/session-start").set(A(stk)).send({ caseId: 1, classId: cid })).status).toBe(403);

    // A non-existent study is refused rather than silently ignored.
    const bad = await request(app).put(`/api/classes/${cid}`).set(A(ttk))
      .send({ name_fa: "ک", name_en: "c", maxAttempts: 5, studyId: 999999 });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe("study_not_found");

    // Clearing it turns the gate back off.
    await request(app).put(`/api/classes/${cid}`).set(A(ttk))
      .send({ name_fa: "ک", name_en: "c", maxAttempts: 5, studyId: null });
    expect((await request(app).get(`/api/classes/${cid}`).set(A(ttk))).body.class.study_id).toBeNull();
    expect((await request(app).post("/api/exam/session-start").set(A(stk)).send({ caseId: 1, classId: cid })).status).toBe(200);
  });
});
