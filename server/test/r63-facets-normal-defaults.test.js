/* ================================================================
   r63-facets-normal-defaults.test.js — Round 63 regression tests.

     1. Every criterion (default checklists, emergency rubrics 101/102, history
        templates) has at least two evidence points, so none is all-or-nothing.
     2. No criterion asks the student for the patient's name.
     3. Lung and heart auscultation: the attending states the finding; the
        recording (when one exists) is sent as audio; no "not uploaded" or
        "you can play" sentence is ever produced.
     4. Information missing from the chart is answered as normal and never
        described as "not recorded" (deterministic patient and teacher paths).
     5. The R63 migration only rewrites exact shipped defaults, and runs once.
   ================================================================ */
import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { DEFAULT_CHECKLIST_1, DEFAULT_CHECKLIST_2, DEFAULT_CHECKLIST_3 } from "../src/data/default-checklists.js";
import { EMERGENCY_RUBRICS } from "../src/data/emergency-rubrics.js";
import * as HS from "../src/lib/history-sections.js";
import { keyedCredit, mockPatientReply, patientReply, teacherExamReply } from "../src/lib/ai-engine.js";
import { migrateR63, R63_FLAG } from "../src/lib/r63-migration.js";
import { PROMPT_DEFAULTS_R63 } from "../src/data/prompt-defaults.js";

// node:sqlite is loaded through createRequire: the vitest transform mis-resolves the bare import.
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");

const evidencePoints = (keys) => (Array.isArray(keys) ? keys : []).map((k) => String(k).split("|").map((x) => x.trim()).filter(Boolean));

function allCriteria() {
  const out = [];
  for (const [n, list] of [["checklist1", DEFAULT_CHECKLIST_1], ["checklist2", DEFAULT_CHECKLIST_2], ["checklist3", DEFAULT_CHECKLIST_3]]) {
    for (const it of list) out.push({ where: `${n}:${it.id}`, label: it.en, fa: it.fa, keys: it.keys });
  }
  for (const [id, def] of Object.entries(EMERGENCY_RUBRICS)) {
    for (const it of def.items) out.push({ where: `rubric${id}:${it.id}`, label: it.en, fa: it.fa, keys: it.keys });
  }
  for (const name of Object.keys(HS)) {
    if (!/TEMPLATE$/.test(name)) continue;
    for (const it of HS[name]) out.push({ where: `${name}:${it.en}`, label: it.en, fa: it.fa, keys: it.keys });
  }
  return out;
}

describe("R63 evidence points: no all-or-nothing criterion", () => {
  const criteria = allCriteria();

  it("covers the default checklists, emergency rubrics and history templates", () => {
    expect(criteria.length).toBeGreaterThanOrEqual(120);
  });

  it.each(criteria.map((c) => [c.where, c]))("%s has at least two evidence points", (_w, c) => {
    const points = evidencePoints(c.keys);
    expect(points.length).toBeGreaterThanOrEqual(2);
    // every point is a non-empty synonym group
    expect(points.every((p) => p.length >= 1)).toBe(true);
  });

  it("a single synonym hit earns part of a two-point criterion, not the whole", () => {
    const ecg = DEFAULT_CHECKLIST_1.find((x) => x.id === "i4");
    expect(keyedCredit("I will order an ECG now", ecg.keys)).toBeCloseTo(0.5, 5);
    expect(keyedCredit("I will order an ECG as soon as possible", ecg.keys)).toBe(1);
    expect(keyedCredit("nothing relevant", ecg.keys)).toBe(0);
  });

  it("synonyms inside one evidence point still count (AI-off grading)", () => {
    const ecg = DEFAULT_CHECKLIST_1.find((x) => x.id === "i4");
    expect(keyedCredit("نوار قلب می‌گیرم", ecg.keys)).toBeGreaterThan(0);
    expect(keyedCredit("ekg", ecg.keys)).toBeGreaterThan(0);
  });
});

describe("R63 patient name is not a criterion", () => {
  it.each(allCriteria().map((c) => [c.where, c]))("%s does not ask for the name", (_w, c) => {
    // "name" of a MEDICATION is not the patient's name
    const asksPatientName = /\bname\b/i.test(c.label || "") && !/medic|drug|dose/i.test(c.label || "");
    expect(asksPatientName).toBe(false);
    expect(/نام\s/.test(c.fa || "")).toBe(false);
  });

  it("the history-taking age criterion still asks about age and occupation", () => {
    const c2 = DEFAULT_CHECKLIST_3.find((x) => x.id === "c2");
    expect(c2.en).toBe("Asked the patient's age and occupation.");
    expect(evidencePoints(c2.keys).length).toBe(2);
  });

  it("the self-introduction criterion accepts student, extern and intern (no 'doctor' requirement)", () => {
    const c1 = DEFAULT_CHECKLIST_3.find((x) => x.id === "c1");
    expect(keyedCredit("I am an extern, and I will examine you. My name is Sara.", c1.keys)).toBe(1);
    expect(keyedCredit("من دانشجو هستم و معرفی می‌کنم", c1.keys)).toBeGreaterThan(0);
  });
});

const CASE = {
  track: "academic",
  exam_fa: "ریه‌ها: صداهای وزیکولر طبیعی، بدون رال. قلب: S1 و S2 واضح، بدون سوفل.",
  exam_en: "Lungs: clear vesicular breath sounds, no crackles. Heart: normal S1 and S2, no murmur.",
  vitals: { bp: "120/80", hr: 80, rr: 16, temp: 37, spo2: 98 },
};

describe("R63 auscultation is stated by the attending; audio is sent when it exists", () => {
  it("with a recording: the lung sound is attached as audio and the text has no playback hint", async () => {
    const caseData = { ...CASE, lungSound: "/uploads/lung.mp3" };
    const r = await patientReply({ caseData, userText: "سمع ریه را انجام می‌دهم", history: [], lang: "fa" });
    expect(r.mode).toBe("exam");
    expect(Array.isArray(r.audio) && r.audio.map((a) => a.kind)).toEqual(["lung"]);
    expect(r.text).not.toMatch(/پخش|ضبط|ثبت نشده|موجود نیست/);
    expect(r.text).toMatch(/ریه|صدا|وزیکولر/);
  });

  it("without a recording: the finding is still stated and nothing says a file is missing", async () => {
    const caseData = { ...CASE };
    const fa = await patientReply({ caseData, userText: "سمع قلب را انجام می‌دهم", history: [], lang: "fa" });
    const en = await patientReply({ caseData, userText: "Auscultate the heart please", history: [], lang: "en" });
    for (const r of [fa, en]) {
      expect(r.audio).toBeUndefined();
      expect(r.text).not.toMatch(/ثبت نشده|فایل صدا|پخش|not been uploaded|not uploaded|play|recording/i);
    }
    expect(fa.text).toMatch(/قلب|S1|طبیعی/);
    expect(en.text).toMatch(/heart|S1|normal/i);
  });

  it("teacherExamReply never mentions a missing or playable recording", () => {
    const withAudio = teacherExamReply({ ...CASE, lungSound: "/x.mp3" }, "en", ["lung"]);
    const without = teacherExamReply(CASE, "en", ["lung"]);
    for (const t of [withAudio, without]) expect(t).not.toMatch(/upload|play|recording|not recorded/i);
  });
});

describe("R63 information missing from the chart is normal, never 'not recorded'", () => {
  it("the deterministic patient answers a question the chart does not cover as normal", () => {
    const caseData = { track: "academic", chief_fa: "شکمم درد می‌کند", chief_en: "My stomach hurts", history_fa: "", history_en: "" };
    for (const [q, lang] of [["آیا سیگار می‌کشی؟", "fa"], ["Do you smoke?", "en"], ["آیا حساسیت دارید؟", "fa"], ["Do you have allergies?", "en"]]) {
      const text = mockPatientReply(caseData, q, lang);
      expect(text).not.toMatch(/ثبت نشده|در پرونده|not recorded|chart|unavailable|missing/i);
      expect(text.length).toBeGreaterThan(0);
    }
  });

  it("the teacher reports a system with no recorded finding as normal", () => {
    const noHeart = { track: "academic", exam_fa: "ریه‌ها: طبیعی", exam_en: "Lungs: normal" };
    const text = teacherExamReply(noHeart, "en", ["heart"]);
    expect(text).not.toMatch(/not recorded|not in the chart|unavailable|missing|no finding/i);
    expect(text).toMatch(/normal/i);
  });

  it("the R63 prompt defaults never tell the patient to say information is unrecorded", () => {
    for (const [k, v] of Object.entries(PROMPT_DEFAULTS_R63)) {
      if (!/rules|lab_normal/.test(k)) continue;
      expect(v, k).not.toMatch(/not recorded|explicitly say|ثبت نشده است|صریحاً بگو/);
    }
    expect(PROMPT_DEFAULTS_R63.lab_normal_en).toMatch(/normal limits/);
  });
});

function memoryDb() {
  const raw = new DatabaseSync(":memory:");
  raw.exec(`CREATE TABLE checklists (id INTEGER PRIMARY KEY, owner_id INTEGER, name_en TEXT, items_json TEXT);
            CREATE TABLE prompts (key TEXT PRIMARY KEY, value TEXT);
            CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);`);
  // Wrap node:sqlite to the small subset the migration uses (db.transaction exists in db.js).
  return {
    raw,
    prepare: (sql) => raw.prepare(sql),
    transaction: (fn) => () => {
      raw.exec("BEGIN");
      try { const out = fn(); raw.exec("COMMIT"); return out; } catch (e) { raw.exec("ROLLBACK"); throw e; }
    },
  };
}

describe("R63 migration", () => {
  it("leaves teacher-edited checklists and admin-edited prompts untouched", () => {
    const db = memoryDb();
    const edited = JSON.stringify([{ id: "i1", weight: 1, en: "mine", keys: ["hello"] }]);
    db.raw.prepare("INSERT INTO checklists (id, owner_id, name_en, items_json) VALUES (1, NULL, 'ACS Checklist', ?)").run(edited);
    db.raw.prepare("INSERT INTO prompts (key, value) VALUES ('patient_rules_en', 'my own rules')").run();
    const stats = migrateR63(db);
    expect(stats.checklists).toBe(0);
    expect(stats.prompts).toBe(0);
    expect(db.raw.prepare("SELECT items_json FROM checklists WHERE id=1").get().items_json).toBe(edited);
    expect(db.raw.prepare("SELECT value FROM prompts WHERE key='patient_rules_en'").get().value).toBe("my own rules");
  });

  it("runs once: the second call is a no-op", () => {
    const db = memoryDb();
    expect(migrateR63(db)).toMatchObject({ checklists: 0, prompts: 0 });
    expect(db.raw.prepare("SELECT value FROM settings WHERE key=?").get(R63_FLAG).value).toBe("1");
    expect(migrateR63(db)).toEqual({ skipped: true });
  });
});
