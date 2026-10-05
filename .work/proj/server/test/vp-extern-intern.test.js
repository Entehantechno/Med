/* ================================================================
   vp-extern-intern.test.js — regression tests for the virtual-patient
   extern/intern work requested for the university module:

     1. the class's grading role actually decides the FINAL score
        (extern = history + physical exam + problem list, up to it;
         intern = all sections) — previously the stored score was
        ALWAYS the overall one, whatever the teacher had selected.
     2. the student's browser no longer receives the answer key
        (diagnosis / objectives / exam findings / lab answers) with
        the case payload.
     3. exam & auscultation requests are answered in the SUPERVISING
        TEACHER's voice from the recorded findings, with the lung/
        heart audio attached when the student asks for a sound.
     4. the problem list the student types is scored (and externs are
        not criticised for the sections outside their criterion).
     5. auscultation audio files can be uploaded (teacher/admin only,
        real audio content verified).
   ================================================================ */
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import request from "supertest";
import { initDb } from "../src/db.js";
import { createApp } from "../src/app.js";
import { computeSectionScores, EXTERN_SCOPE } from "../src/lib/history-sections.js";

let app;
const login = (u, p = "demo") => request(app).post("/api/auth/login").send({ username: u, password: p });
async function token(u, p = "demo") { return (await login(u, p)).body.token; }
const A = (tk) => ({ Authorization: `Bearer ${tk}` });

beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb();
  app = createApp();
});

/* Fresh class owned by `teacher`, `stuId` enrolled, `caseId` attached. */
async function makeClass(tk, stuId, caseId, gradingRole = "history") {
  const created = await request(app).post("/api/classes").set(A(tk))
    .send({ name_en: `ExtInt ${Math.random()}`, name_fa: "اکسترن/اینترن", gradingRole });
  const cid = created.body.id;
  await request(app).put(`/api/classes/${cid}/members`).set(A(tk)).send({ userIds: [stuId] });
  await request(app).put(`/api/classes/${cid}/cases`).set(A(tk)).send({ cases: [{ case_id: caseId, weight: 1 }] });
  return cid;
}

async function studentId(tk, username) {
  const users = (await request(app).get("/api/users").set(A(tk))).body;
  return users.find((u) => u.username === username).id;
}

/* A case with multi-section checklist: history + exam + (synthesised
   problem list) + workup + management — so extern and intern scopes
   really differ. */
async function makeMultiSectionCase(tk) {
  const cl = await request(app).post("/api/checklists").set(A(tk)).send({
    name_fa: "چک‌لیست چندبخشی تست", name_en: "Multi-section test checklist",
    items: [
      { id: "h1", section: "history", weight: 2, fa: "معرفی خود", en: "Introduce", keys: ["سلام", "hello"] },
      { id: "e1", section: "exam", weight: 2, fa: "درخواست معاینه", en: "Request exam", keys: ["معاینه", "examine"] },
      { id: "w1", section: "workup", weight: 4, fa: "درخواست ECG", en: "Order ECG", keys: ["ecg", "نوار قلب"] },
      { id: "m1", section: "management", weight: 3, fa: "پلن درمان", en: "Treatment plan", keys: ["آسپرین", "aspirin"] },
    ],
  });
  const c = await request(app).post("/api/cases").set(A(tk)).send({
    title_fa: "کیس تست اکسترن/اینترن", title_en: "Ext/intern test case",
    age: 55, sex: "male", specialty_fa: "داخلی", specialty_en: "Internal",
    chief_fa: "درد قفسه سینه", chief_en: "Chest pain",
    history_fa: "درد فشارنده از ۲ ساعت پیش", history_en: "Crushing pain 2h",
    exam_fa: "مضطرب، صداهای قلبی طبیعی", exam_en: "Anxious, normal heart sounds",
    vitals: { bp: "140/90", hr: "95" },
    problem_list_fa: "درد قفسه سینه\nدیابت", problem_list_en: "Chest pain\nDiabetes",
    ddx_fa: "ACS\nترومبوز وریدی عمقی", ddx_en: "ACS\nDeep vein thrombosis",
    diagnosis_fa: "ACS", diagnosis_en: "ACS",
    checklist_id: cl.body.id,
  });
  return c.body.id;
}

const EXTERN_SESSION = {
  messages: [
    { role: "student", text: "سلام من دکتر هستم، خودم را معرفی می‌کنم" },
    { role: "patient", text: "سلام دکتر" },
    { role: "student", text: "حالا می‌خوام بیمار را معاینه کنم، لطفن معاینه را شرح دهید" },
    { role: "patient", text: "پروفسور: بیمار را معاینه کردم." },
  ],
  tests: [], imaging: [], ddx: [], finalDx: "",
  problemList: ["درد قفسه سینه", "دیابت"],
};

describe("extern/intern grading scope", () => {
  it("computeSectionScores: extern = history+exam+problem_list+ddx only", () => {
    const results = [
      { id: "a", label: "h", weight: 5, done: true, section: "history" },
      { id: "b", label: "e", weight: 5, done: true, section: "exam" },
      { id: "c", label: "p", weight: 3, done: false, section: "problem_list" },
      { id: "f", label: "d", weight: 2, done: true, section: "ddx" },
      { id: "d", label: "w", weight: 4, done: false, section: "workup" },
      { id: "e", label: "m", weight: 5, done: false, section: "management" },
    ];
    const ss = computeSectionScores(results, "fa");
    expect(ss.overall).toBe(50);           // 12/24
    expect(ss.extern).toBe(80);            // 12/15 (history+exam+problem_list+ddx)
    expect(EXTERN_SCOPE).toEqual(["history", "exam", "problem_list", "ddx"]);
  });

  it("EXTERN class: final stored score = extern scope (up to the differential dx)", async () => {
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40012345");
    const caseId = await makeMultiSectionCase(ttk);
    const classId = await makeClass(ttk, stuId, caseId, "history");
    const stk = await token("40012345");
    const r = await request(app).post("/api/exam/evaluate").set(A(stk))
      .send({ caseId, classId, lang: "fa", durationSec: 300, session: EXTERN_SESSION });
    expect(r.status).toBe(200);
    const b = r.body;
    // extern criterion: h1(2) + e1(2) + pl01(3) done, ddx01(3) NOT done
    // (the session's ddx box is empty) → 7/10; overall = 7/17.
    expect(b.meta?.gradingScope).toBe("extern");
    expect(b.sectionScores?.extern).toBe(70);
    expect(b.sectionScores?.overall).toBe(41);
    expect(b.score).toBe(70);                     // FINAL = extern, NOT overall
    expect(b.score10).toBe(7);
    // the missing differentials ARE an extern-criterion weakness
    expect((b.weaknesses || []).join(" | ")).toMatch(/افتراقی/);
    // ...but externs must not be criticised for sections outside their criterion
    const weak = (b.weaknesses || []).join(" | ");
    expect(weak).not.toMatch(/آزمایشی درخواست نشد|paraclinical/i);
    expect(weak).not.toMatch(/تشخیص نهایی صحیح ثبت نشد/);
  });

  it("EXTERN class: a good differential list earns the ddx points", async () => {
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40022334");
    const caseId = await makeMultiSectionCase(ttk);
    const classId = await makeClass(ttk, stuId, caseId, "history");
    const stk = await token("40022334");
    const session = {
      ...EXTERN_SESSION,
      ddx: ["ACS", "ترومبوز وریدی عمقی"],   // covers both expected differentials
    };
    const r = await request(app).post("/api/exam/evaluate").set(A(stk))
      .send({ caseId, classId, lang: "fa", durationSec: 300, session });
    expect(r.status).toBe(200);
    const b = r.body;
    expect(b.sectionScores?.extern).toBe(100);    // h1+e1+pl01+ddx01 all done
    expect(b.score).toBe(100);
    expect((b.weaknesses || []).join(" | ")).not.toMatch(/افتراقی/);
  });

  it("INTERN class: final stored score = all sections", async () => {
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40067890");
    const caseId = await makeMultiSectionCase(ttk);
    const classId = await makeClass(ttk, stuId, caseId, "overall");
    const stk = await token("40067890");
    const r = await request(app).post("/api/exam/evaluate").set(A(stk))
      .send({ caseId, classId, lang: "fa", durationSec: 300, session: EXTERN_SESSION });
    expect(r.status).toBe(200);
    const b = r.body;
    expect(b.meta?.gradingScope).toBe("intern");
    expect(b.sectionScores?.intern).toBe(41);
    expect(b.meta?.internScore).toBe(41);
    expect(b.score).toBe(41);                   // FINAL = overall 7/17 (workup/plan/ddx missed)
    // and the missing workup IS held against an intern
    expect((b.weaknesses || []).join(" | ")).toMatch(/آزمایش|paraclinical/i);
  });

  it("session-start reports the class's grading scope to the client", async () => {
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40022334");
    const caseId = await makeMultiSectionCase(ttk);
    const classId = await makeClass(ttk, stuId, caseId, "history");
    const stk = await token("40022334");
    const r = await request(app).post("/api/exam/session-start").set(A(stk))
      .send({ caseId, classId, lang: "fa" });
    expect(r.status).toBe(200);
    expect(r.body.gradingScope).toBe("extern");
    expect(r.body.gradingRubric).toBeUndefined();
    const tstart = await request(app).post("/api/exam/session-start").set(A(ttk))
      .send({ caseId, classId, lang: "fa" });
    expect(tstart.status).toBe(200);
    expect(tstart.body.gradingRubric?.roles?.extern?.sections).toEqual(["history", "exam", "problem_list", "ddx"]);
  });
});

describe("class deactivation revokes case access", () => {
  it("a student of a deactivated class can no longer reach the class's cases", async () => {
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40011223");
    const caseId = await makeMultiSectionCase(ttk);
    const classId = await makeClass(ttk, stuId, caseId, "both");
    const stk = await token("40011223");
    // accessible while the class is active (access via class membership)
    let r = await request(app).get(`/api/cases/${caseId}`).set(A(stk));
    expect(r.status).toBe(200);
    // soft-delete the class → students lose access even by guessing the case id
    const del = await request(app).del(`/api/classes/${classId}`).set(A(ttk));
    expect(del.status).toBe(200);
    r = await request(app).get(`/api/cases/${caseId}`).set(A(stk));
    expect(r.status).toBe(403);
    // ...and the encounter endpoints refuse too
    const reply = await request(app).post("/api/exam/patient-reply").set(A(stk))
      .send({ caseId, classId, lang: "fa", userText: "سلام", history: [] });
    expect(reply.status).toBe(403);
  });
});

describe("student case payload no longer leaks the answer key", () => {
  it("student GET /cases/:id hides diagnosis, objectives, exam findings, lab answers", async () => {
    const ttk = await token("teacher");
    const caseId = await makeMultiSectionCase(ttk);
    const stuId = await studentId(ttk, "40033445");
    await makeClass(ttk, stuId, caseId, "both");   // grant access
    const stk = await token("40033445");
    const r = await request(app).get(`/api/cases/${caseId}`).set(A(stk));
    expect(r.status).toBe(200);
    const b = r.body;
    expect(b.diagnosis_fa).toBeUndefined();
    expect(b.diagnosis_en).toBeUndefined();
    expect(b.objectives_fa).toBeUndefined();
    expect(b.exam_fa).toBeUndefined();
    expect(b.vitals).toBeUndefined();
    expect(b.labResults).toBeUndefined();
    expect(b.problem_list_fa).toBeUndefined();
    expect(b.ddx_fa).toBeUndefined();
    expect(b.ddx_en).toBeUndefined();
    expect(b.checklist_id).toBeUndefined();
    // ...but the card data the UI needs is still there. Round 5: the case
    // TITLE is hidden from students too (it often names the diagnosis); the
    // chief complaint is what the student sees.
    expect(b.title_fa).toBeUndefined();
    expect(b.title_en).toBeUndefined();
    expect(b.chief_fa).toBeTruthy();
    expect(b.age).toBe(55);
  });

  it("teacher GET /cases/:id still gets the full record", async () => {
    const ttk = await token("teacher");
    const caseId = await makeMultiSectionCase(ttk);
    const r = await request(app).get(`/api/cases/${caseId}`).set(A(ttk));
    expect(r.status).toBe(200);
    expect(r.body.diagnosis_fa).toBe("ACS");
    expect(r.body.exam_fa).toBeTruthy();
  });
});

describe("supervising-teacher exam mode + auscultation audio (mock engine)", () => {
  async function caseWithSounds(tk) {
    const c = await request(app).post("/api/cases").set(A(tk)).send({
      title_fa: "کیس تست سمع", title_en: "Sound test case", age: 60, sex: "male",
      chief_fa: "تنگی نفس", chief_en: "Dyspnea",
      exam_fa: "رطوبت قاعده‌ای دو‌طرفه", exam_en: "Bibasilar crackles",
      vitals: { hr: "100", spo2: "92%" },
      lungSound: "/uploads/test-lung.mp3",
      // heartSound deliberately absent
    });
    return c.body.id;
  }

  it("exam request → answered as the teacher with the recorded findings", async () => {
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40044556");
    const caseId = await caseWithSounds(ttk);
    const classId = await makeClass(ttk, stuId, caseId, "overall");
    const stk = await token("40044556");
    const r = await request(app).post("/api/exam/patient-reply").set(A(stk))
      .send({ caseId, classId, lang: "fa", userText: "لطفاً بیمار را معاینه کنید و یافته‌ها را بگویید", history: [] });
    expect(r.status).toBe(200);
    expect(r.body.mode).toBe("exam");
    // Round 5: a blanket "examine the patient" is never answered — the
    // attending asks which examination exactly.
    expect(r.body.clarify).toBe(true);
    expect(r.body.text).not.toContain("رطوبت قاعده‌ای");
    // a specific system request gets ONLY that system's recorded findings
    const r2 = await request(app).post("/api/exam/patient-reply").set(A(stk))
      .send({ caseId, classId, lang: "fa", userText: "ریه‌ها را معاینه کنید", history: [] });
    expect(r2.body.mode).toBe("exam");
    expect(r2.body.text).toContain("رطوبت قاعده‌ای");   // from the recorded exam_fa
    expect(r2.body.text).not.toContain("HR 100");        // vitals not volunteered
    const r3 = await request(app).post("/api/exam/patient-reply").set(A(stk))
      .send({ caseId, classId, lang: "fa", userText: "علائم حیاتی", history: [] });
    expect(r3.body.text).toContain("100");              // vital signs on request
  });

  it("lung-sound request → the uploaded audio is attached to the reply", async () => {
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40055667");
    const caseId = await caseWithSounds(ttk);
    const classId = await makeClass(ttk, stuId, caseId, "overall");
    const stk = await token("40055667");
    const r = await request(app).post("/api/exam/patient-reply").set(A(stk))
      .send({ caseId, classId, lang: "fa", userText: "صدای سمع ریه را برام پخش کن", history: [] });
    expect(r.status).toBe(200);
    expect(r.body.mode).toBe("exam");
    expect(r.body.audio?.length).toBe(1);
    expect(r.body.audio[0].kind).toBe("lung");
    expect(r.body.audio[0].url).toBe("/uploads/test-lung.mp3");
  });

  it("heart-sound request with no recording → no audio, polite note", async () => {
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40066778");
    const caseId = await caseWithSounds(ttk);
    const classId = await makeClass(ttk, stuId, caseId, "overall");
    const stk = await token("40066778");
    const r = await request(app).post("/api/exam/patient-reply").set(A(stk))
      .send({ caseId, classId, lang: "fa", userText: "صدای سمع قلب رو می‌خوام", history: [] });
    expect(r.status).toBe(200);
    expect(r.body.mode).toBe("exam");
    expect(r.body.audio?.length || 0).toBe(0);
    expect(r.body.text).toMatch(/ثبت نشده|در دسترس نیست/);
  });

  it("history questions still stay in patient mode", async () => {
    const ttk = await token("teacher");
    const stuId = await studentId(ttk, "40011223");
    const caseId = await caseWithSounds(ttk);
    const classId = await makeClass(ttk, stuId, caseId, "overall");
    const stk = await token("40011223");
    const r = await request(app).post("/api/exam/patient-reply").set(A(stk))
      .send({ caseId, classId, lang: "fa", userText: "چه مشکلی دارید؟", history: [] });
    expect(r.status).toBe(200);
    expect(r.body.mode).toBe("patient");
  });
});

describe("auscultation audio upload", () => {
  const mp3 = Buffer.concat([
    Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00]),  // ID3 magic
    Buffer.alloc(64, 0xff),
  ]);

  it("teacher uploads a real MP3 → url under /uploads", async () => {
    const ttk = await token("teacher");
    const r = await request(app).post("/api/upload/audio").set(A(ttk))
      .attach("audio", mp3, "lung.mp3");
    expect(r.status).toBe(200);
    expect(r.body.url).toMatch(/^\/uploads\/snd_.*\.mp3$/);
  });

  it("rejects a file with fake content (magic-byte check)", async () => {
    const ttk = await token("teacher");
    const r = await request(app).post("/api/upload/audio").set(A(ttk))
      .attach("audio", Buffer.from("this is definitely not an mp3 file"), "fake.mp3");
    expect(r.status).toBe(400);
  });

  it("student cannot upload audio", async () => {
    const stk = await token("40012345");
    const r = await request(app).post("/api/upload/audio").set(A(stk))
      .attach("audio", mp3, "lung.mp3");
    expect(r.status).toBe(403);
  });

  it("library lists the uploaded audio as kind=audio", async () => {
    const ttk = await token("teacher");
    const up = await request(app).post("/api/upload/audio").set(A(ttk))
      .attach("audio", mp3, "heart.mp3");
    const lib = await request(app).get("/api/upload/library").set(A(ttk));
    const found = (lib.body.items || []).find((x) => x.url === up.body.url);
    expect(found?.kind).toBe("audio");
  });
});
