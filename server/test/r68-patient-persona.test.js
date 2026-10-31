// Round 68: the virtual patient behaves like a person in the room.
// (1) Asked for its name, a patient with no name on the card gives a first name
//     that matches the card's sex, or says the name is on the triage sheet. The
//     answer is fixed for one encounter.
// (2) When the patient calls the student «دکتر», the honorific depends on the
//     student's gender: «آقای دکتر» / «خانم دکتر». When it is unknown, «دکتر» alone.
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import request from "supertest";
import { initDb } from "../src/db.js";
import { createApp } from "../src/app.js";
import { patientReply } from "../src/lib/ai-engine.js";
import { genderFromStudentName, addressDoctor, patientNameAnswer } from "../src/lib/patient-persona.js";

const female = { sex: "female", age: 40, chief_fa: "درد شکم از دیشب", history_fa: "درد شکم از دیشب شروع شده، با تهوع.", chief_en: "Abdominal pain since last night", history_en: "Abdominal pain since last night, with nausea." };
const male = { ...female, sex: "male" };
const noAiCfg = {};
const noPrompts = {};
const ask = (caseData, userText, student, seed = "enc-1", lang = "fa") =>
  patientReply({ caseData, userText, history: [], lang, prompts: noPrompts, aiCfg: noAiCfg }, { seed, student });

describe("R68 student gender from the name", () => {
  it("recognises common Persian and English first names", () => {
    expect(genderFromStudentName({ name_fa: "علی رضایی", name_en: "Ali Rezaei" })).toBe("male");
    expect(genderFromStudentName({ name_fa: "مریم حسینی", name_en: "Maryam Hosseini" })).toBe("female");
    expect(genderFromStudentName({ name_fa: "محمدمهدی فتحی" })).toBe("male");
    expect(genderFromStudentName({ name_fa: "نیلوفر احمدی" })).toBe("female");
  });
  it("returns null when the name does not tell (no guessing)", () => {
    expect(genderFromStudentName({ name_fa: "دانشجوی اراک" })).toBeNull();
    expect(genderFromStudentName({})).toBeNull();
  });
});

describe("R68 the honorific for the student", () => {
  it("female student: «خانم دکتر»", () => {
    expect(addressDoctor("سلام دکتر. نه، چیز خاصی نیست دکتر.", "female")).toBe("سلام خانم دکتر. نه، چیز خاصی نیست خانم دکتر.");
  });
  it("male student: «آقای دکتر»", () => {
    expect(addressDoctor("ببخشید دکتر، دوباره بگویید.", "male")).toBe("ببخشید آقای دکتر، دوباره بگویید.");
  });
  it("unknown gender: plain «دکتر», and any «آقا»/«خانم» the model added is removed", () => {
    expect(addressDoctor("سلام آقای دکتر، ببخشید خانم دکتر", null)).toBe("سلام دکتر، ببخشید دکتر");
  });
  it("does not touch words that merely start with دکتر", () => {
    expect(addressDoctor("دکتری خوانده‌ام، دکتر.", "female")).toBe("دکتری خوانده‌ام، خانم دکتر.");
  });
});

describe("R68 the patient's name", () => {
  it("is fixed for one encounter (asking twice gives the same answer)", () => {
    expect(patientNameAnswer(female, "enc-7", "fa")).toBe(patientNameAnswer(female, "enc-7", "fa"));
  });
  it("varies between encounters", () => {
    const seen = new Set();
    for (let i = 0; i < 40; i++) seen.add(patientNameAnswer(female, `enc-${i}`, "fa"));
    expect(seen.size).toBeGreaterThan(3);
  });
  it("a female patient is never given a male first name, and vice versa", () => {
    const maleFa = ["علی", "حسین", "محمد", "احمد", "رضا", "مهدی", "امیر", "سعید", "کامران", "پوریا", "پارسا", "کیان", "نیما"];
    for (let i = 0; i < 60; i++) {
      const a = patientNameAnswer(female, `f-${i}`, "fa");
      for (const m of maleFa) expect(a.startsWith(`اسمم ${m} `)).toBe(false);
    }
    const femaleFa = ["زهرا", "فاطمه", "مریم", "سارا", "نرگس", "نیلوفر", "شیرین", "یاسمن"];
    let sawFemale = false;
    for (let i = 0; i < 60; i++) {
      const a = patientNameAnswer(male, `m-${i}`, "fa");
      if (femaleFa.some((f) => a.startsWith(`اسمم ${f} `))) sawFemale = true;
    }
    expect(sawFemale).toBe(false);
  });
  it("sometimes the name is on the triage sheet instead", () => {
    const seen = new Set();
    for (let i = 0; i < 40; i++) seen.add(patientNameAnswer(female, `t-${i}`, "fa").includes("تریاژ"));
    expect(seen.has(true)).toBe(true);
  });
  it("a name written on the case is used as is", () => {
    expect(patientNameAnswer({ ...female, patient_name_fa: "پروین کاظمی" }, "x", "fa")).toBe("اسمم پروین کاظمی است دکتر.");
  });
  it("English question gets an English answer", () => {
    expect(patientNameAnswer(male, "e-1", "en")).toMatch(/^(My name is [A-Za-z]+, doctor\.|My name is on the triage sheet, doctor\.)$/);
  });
});

describe("R68 patientReply uses the student's gender for «دکتر»", () => {
  it("greeting «سلام دکتر» to a female student: «سلام خانم دکتر.»", async () => {
    expect((await ask(female, "سلام دکتر", { name_fa: "مریم حسینی" })).text).toBe("سلام خانم دکتر.");
  });
  it("greeting to a male student: «سلام آقای دکتر.»", async () => {
    expect((await ask(female, "سلام دکتر", { name_fa: "علی رضایی" })).text).toBe("سلام آقای دکتر.");
  });
  it("greeting to a student of unknown gender: «سلام دکتر.»", async () => {
    expect((await ask(female, "سلام دکتر", { name_fa: "دانشجوی اراک" })).text).toBe("سلام دکتر.");
  });
  it("a question addressed to «دکتر» is still answered, not treated as a greeting", async () => {
    const r = await ask(female, "دکتر، درد شکم از کی شروع شد؟", { name_fa: "مریم حسینی" });
    expect(r.text).toMatch(/دیشب|شروع/);
    expect(r.text).not.toMatch(/متوجه سؤالتان نشدم/);
  });
  it("the name question is answered from the same encounter every time", async () => {
    const a = await ask(male, "اسمتان چیست؟", { name_fa: "مریم حسینی" }, "enc-99");
    const b = await ask(male, "اسمتان چیست؟", { name_fa: "مریم حسینی" }, "enc-99");
    expect(a.text).toBe(b.text);
    expect(a.text).toContain("خانم دکتر");
  });
});

describe("R68 HTTP: the route sends the logged-in student's name", () => {
  let app;
  const login = (u, p = "demo") => request(app).post("/api/auth/login").send({ username: u, password: p });
  beforeAll(async () => {
    execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
    await initDb();
    app = createApp();
  });
  it("student 40012345 (علی رضایی) is greeted as «آقای دکتر»", async () => {
    const tk = (await login("40012345")).body.token;
    const A = { Authorization: `Bearer ${tk}` };
    const sess = await request(app).post("/api/exam/session-start").set(A).send({ caseId: 1, lang: "fa" });
    expect(sess.status).toBe(200);
    const r = await request(app).post("/api/exam/patient-reply").set(A)
      .send({ sessionId: sess.body.sessionId, caseId: 1, userText: "سلام دکتر", history: [], lang: "fa" });
    expect(r.status).toBe(200);
    expect(r.body.text).toBe("سلام آقای دکتر.");
  });
});
