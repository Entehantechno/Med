/* Lesson translation (درسنامه in the site language) — server contract.

   Pure rules:   serializeCard pending fields, hashes, validation, budget, summary items.
   API:          POST /learn/lessons/translate (access, budget, AI unavailable,
                 malformed output), POST /learn/study-plan/translate.
   Personal:     the VP micro-lesson prompt carries the student's own failed
                 history / approach items (personalization must not be lost). */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { execSync } from "node:child_process";
import request from "supertest";
import { initDb, db } from "../src/db.js";
import { createApp } from "../src/app.js";
import { setSetting } from "../src/routes/content.js";
import { serializeCard } from "../src/lib/cardserialize.js";
import {
  microMissing, microValue, microSourceBundle, microSourceHash, validateMicroTranslation,
  pickMicroTranslation, summaryPick, takeLessonBudget, _resetLessonBudget,
} from "../src/lib/lesson-translate.js";
import { summaryItemsFromCards, bulletsOf } from "../src/lib/chaptersummary.js";
import { enrichEvaluationWithLLM, resolveAiConfig } from "../src/lib/ai-engine.js";

const EN_ONLY = {
  lead_en: "Chiasm lesions cause bitemporal hemianopia.",
  golden_en: "Think of the optic chiasm for bitemporal loss.",
  points_en: ["Nasal fibres cross at the chiasm.", "Temporal fibres stay ipsilateral."],
  options_en: [],
  source_en: "Harrison 21e",
};
const mcq = (micro, extra = {}) => ({
  type: "mcq", q_fa: "کدام ضایعه همی‌آنوپسی دوطرفهٔ تمپورال ایجاد می‌کند؟", q_en: "Which lesion causes bitemporal hemianopia?",
  options: [{ fa: "الف", en: "A", correct: false }, { fa: "ب", en: "B", correct: true }],
  micro, ...extra,
});
const rowOf = (data) => ({ id: 1, public_code: null, difficulty: "medium", data_json: JSON.stringify(data) });

describe("serializeCard — درسنامه follows the site language", () => {
  it("an English-only درسنامه shows pending fields in Persian, never English as Persian", () => {
    const s = serializeCard(rowOf(mcq(EN_ONLY)), "fa");
    expect(s.micro.pending).toBeTruthy();
    expect(s.micro.pending.from).toBe("en");
    expect(s.micro.pending.to).toBe("fa");
    expect(s.micro.pending.fields).toEqual(expect.arrayContaining(["lead", "golden", "points", "source"]));
    // the source text is still carried (it is what gets translated), but it is marked pending
    expect(s.micro.pending.fields).not.toContain("options");
  });

  it("a Persian site with Persian text has no pending fields and no cross-language leak", () => {
    const s = serializeCard(rowOf(mcq({ lead_fa: "لید فارسی", golden_fa: "طلایی فارسی", lead_en: "EN lead", golden_en: "EN gold" })), "fa");
    expect(s.micro.pending).toBeNull();
    expect(s.micro.lead).toBe("لید فارسی");
    expect(s.micro.golden).toBe("طلایی فارسی");
  });

  it("with a field authored in the site language, only the missing field is pending", () => {
    const s = serializeCard(rowOf(mcq({ lead_fa: "لید فارسی", points_en: ["Only English point"] })), "fa");
    expect(s.micro.lead).toBe("لید فارسی");
    expect(s.micro.pending.fields).toEqual(["points"]);
  });

  it("legacy unsuffixed source is language-neutral and never triggers translation", () => {
    const s = serializeCard(rowOf(mcq({ lead_fa: "لید", source: "Harrison" })), "fa");
    expect(s.micro.pending).toBeNull();
    expect(s.micro.source).toBe("Harrison");
  });

  it("the flashcard question keeps its whole-card fallback (single-language card shown to all)", () => {
    const en = serializeCard(rowOf({ type: "mcq", q_en: "Only English question", options: [{ fa: "الف", en: "A", correct: true }], micro: null }), "fa");
    expect(en.question || en.q || en.prompt || JSON.stringify(en)).toMatch(/Only English question/);
  });

  it("a card with both question languages shows the one matching the student", () => {
    const fa = serializeCard(rowOf(mcq(null)), "fa");
    const en = serializeCard(rowOf(mcq(null)), "en");
    expect(JSON.stringify(fa)).toMatch(/کدام ضایعه/);
    expect(JSON.stringify(en)).toMatch(/Which lesion/);
  });

  it("the pending hash changes with the authored source and not otherwise", () => {
    const a = serializeCard(rowOf(mcq({ ...EN_ONLY })), "fa").micro.pending.hash;
    const b = serializeCard(rowOf(mcq({ ...EN_ONLY })), "fa").micro.pending.hash;
    const c = serializeCard(rowOf(mcq({ ...EN_ONLY, lead_en: "Edited lead." })), "fa").micro.pending.hash;
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("translation validation and application", () => {
  const m = { ...EN_ONLY };
  const miss = microMissing(m, "fa");
  const src = microSourceBundle(m, miss);

  it("microMissing lists exactly the fields present in the other language only", () => {
    expect(miss.from).toBe("en");
    expect(miss.fields).toEqual(["lead", "golden", "points", "source"]);
    expect(microMissing({ lead_fa: "x", lead_en: "y" }, "fa").fields).toEqual([]);
  });

  it("accepts a well-formed translation and keeps only requested fields", () => {
    const t = { lead: "ضایعهٔ کیاسما", golden: "طلایی", points: ["الف", "ب"], source: "هاریسون", extra: "ignored" };
    expect(validateMicroTranslation(src, t)).toBe(true);
    expect(pickMicroTranslation(src, t)).toEqual({ lead: "ضایعهٔ کیاسما", golden: "طلایی", points: ["الف", "ب"], source: "هاریسون" });
  });

  it("rejects a translation with the wrong list length, blank items, or missing text", () => {
    expect(validateMicroTranslation(src, { lead: "x", golden: "y", points: ["only one"], source: "z" })).toBe(false);
    expect(validateMicroTranslation(src, { lead: "x", golden: "y", points: ["", "b"], source: "z" })).toBe(false);
    expect(validateMicroTranslation(src, { lead: "", golden: "y", points: ["a", "b"], source: "z" })).toBe(false);
    expect(validateMicroTranslation(src, "not an object")).toBe(false);
  });

  it("microValue never falls back to the other language", () => {
    expect(microValue(m, "lead", "fa")).toBe("");
    expect(microValue(m, "lead", "en")).toBe(m.lead_en);
  });

  it("the summary line follows golden > lead > first point in the given language", () => {
    expect(summaryPick({ golden_fa: "طلایی", lead_fa: "لید" }, "fa")).toEqual({ kind: "golden", text: "طلایی" });
    expect(summaryPick({ lead_fa: "لید", points_fa: ["p"] }, "fa")).toEqual({ kind: "lead", text: "لید" });
    expect(summaryPick({ points_en: ["p"] }, "fa")).toBeNull();
  });
});

describe("chapter summary items", () => {
  it("keeps lesson order, marks pending items, and dedupes native bullets", () => {
    const cards = [
      { id: 1, data_json: JSON.stringify(mcq({ golden_fa: "نکتهٔ یک" })) },
      { id: 2, data_json: JSON.stringify(mcq(EN_ONLY)) },
      { id: 3, data_json: JSON.stringify(mcq({ golden_fa: "نکتهٔ یک" })) },
    ];
    const items = summaryItemsFromCards(cards, "fa");
    expect(items.map((i) => i.cardId)).toEqual([1, 2, 3]);
    expect(items[1].pending).toBeTruthy();
    expect(items[1].field).toBe("golden");
    expect(items[1].text).toBeNull();
    expect(bulletsOf(items)).toEqual(["نکتهٔ یک"]);
  });
});

describe("per-user lesson translation budget", () => {
  beforeEach(() => { _resetLessonBudget(); vi.stubEnv("LESSON_TRANSLATE_PER_HOUR", "2"); });
  afterEach(() => { vi.unstubAllEnvs(); _resetLessonBudget(); });
  it("allows the configured number of AI calls per hour, then resets", () => {
    const t0 = 1_000_000;
    expect(takeLessonBudget(7, t0)).toBe(true);
    expect(takeLessonBudget(7, t0 + 1)).toBe(true);
    expect(takeLessonBudget(7, t0 + 2)).toBe(false);
    expect(takeLessonBudget(8, t0 + 2)).toBe(true);     // another learner is not affected
    expect(takeLessonBudget(7, t0 + 60 * 60 * 1000 + 5)).toBe(true);
  });
});

/* ---------- API ---------- */

const A = (tk) => ({ Authorization: `Bearer ${tk}` });
let app, learner;

function fakeModel(reply) {
  const calls = [];
  vi.stubGlobal("fetch", vi.fn(async (url, init) => {
    const body = JSON.parse(init.body);
    const user = body.messages.at(-1).content;
    calls.push({ system: body.messages[0].content, user });
    const value = reply(user);
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: typeof value === "string" ? value : JSON.stringify(value) } }] }) };
  }));
  return calls;
}
function translateAll(items) {
  const out = {};
  for (const [id, b] of Object.entries(items)) {
    const t = {};
    for (const [k, v] of Object.entries(b)) t[k] = Array.isArray(v) ? v.map((x) => `FA:${x}`) : `FA:${v}`;
    out[id] = t;
  }
  return out;
}
function addCard(data, { premium = 0, nodeCards = true } = {}) {
  const id = db.prepare("INSERT INTO flashcards (data_json, difficulty, active) VALUES (?, 'medium', 1)").run(JSON.stringify(data)).lastInsertRowid;
  if (nodeCards) {
    const topic = db.prepare("SELECT id FROM topics LIMIT 1").get();
    db.prepare("INSERT INTO path_nodes (topic_id, title_fa, title_en, ord, card_ids, premium, active) VALUES (?, 'درس تست', 'Test lesson', 999, ?, ?, 1)")
      .run(topic.id, JSON.stringify([id]), premium);
  }
  return id;
}
const tr = (cardIds, to = "fa") => request(app).post("/api/learn/lessons/translate").set(A(learner)).send({ to, cardIds });

beforeAll(async () => {
  execSync("node src/seed.js --force", { stdio: "ignore" });
  await initDb();
  app = createApp();
  learner = (await request(app).post("/api/auth/login").send({ username: "learner", password: "demo" })).body.token;
  expect(learner).toBeTruthy();
});
beforeEach(() => {
  _resetLessonBudget();
  vi.stubEnv("LESSON_TRANSLATE_PER_HOUR", "60");
  setSetting("ai", { provider: "OpenRouter", model: "test/free", apiKey: "synthetic-only" });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("POST /learn/lessons/translate", () => {
  it("translates only the missing fields, caches nothing server-side, and returns the server hash", async () => {
    const id = addCard(mcq(EN_ONLY));
    const calls = fakeModel((user) => translateAll(JSON.parse(user)));
    const r = await tr([id, 999999, "bad"]);
    expect(r.status).toBe(200);
    expect(calls.length).toBe(1);
    const sent = JSON.parse(calls[0].user);
    expect(Object.keys(sent)).toEqual([String(id)]);
    expect(Object.keys(sent[id]).sort()).toEqual(["golden", "lead", "points", "source"]);
    expect(calls[0].user).not.toMatch(/کدام ضایعه/); // no Persian question leaks into the prompt
    const expected = serializeCard(rowOf(mcq(EN_ONLY)), "fa").micro.pending.hash;
    expect(r.body.hashes[id]).toBe(expected);
    expect(r.body.translations[id].lead).toBe(`FA:${EN_ONLY.lead_en}`);
    expect(r.body.translations[id].points).toHaveLength(2);
    expect(r.body.failed).toEqual([]);
  });

  it("returns same:true with no AI call when nothing is pending", async () => {
    const id = addCard(mcq({ lead_fa: "لید", lead_en: "lead", golden_fa: "طلایی", golden_en: "gold" }));
    const calls = fakeModel((user) => translateAll(JSON.parse(user)));
    const r = await tr([id]);
    expect(r.body.same).toBe(true);
    expect(calls.length).toBe(0);
  });

  it("refuses cards the learner cannot see (no node) and premium nodes for free learners", async () => {
    const hidden = addCard(mcq(EN_ONLY), { nodeCards: false });
    const premium = addCard(mcq(EN_ONLY), { premium: 1 });
    const calls = fakeModel((user) => translateAll(JSON.parse(user)));
    const r = await tr([hidden, premium]);
    expect(r.status).toBe(200);
    expect(r.body.translations).toEqual({});
    expect(calls.length).toBe(0);
  });

  it("without a configured AI it fails clearly and makes no call", async () => {
    const id = addCard(mcq(EN_ONLY));
    setSetting("ai", {});
    const calls = fakeModel((user) => translateAll(JSON.parse(user)));
    const r = await tr([id]);
    expect(r.status).toBe(503);
    expect(r.body.error).toBe("ai_unavailable");
    expect(r.body.message_fa).toBeTruthy();
    expect(calls.length).toBe(0);
  });

  it("is limited per learner per hour, and the refusal makes no AI call", async () => {
    vi.stubEnv("LESSON_TRANSLATE_PER_HOUR", "1");
    const id = addCard(mcq(EN_ONLY));
    const calls = fakeModel((user) => translateAll(JSON.parse(user)));
    expect((await tr([id])).status).toBe(200);
    const r2 = await tr([id]);
    expect(r2.status).toBe(429);
    expect(calls.length).toBe(1);
  });

  it("rejects malformed model output for that card only, and never stores it", async () => {
    const good = addCard(mcq(EN_ONLY));
    const bad = addCard(mcq({ ...EN_ONLY, lead_en: "Second card." }));
    fakeModel((user) => {
      const items = JSON.parse(user);
      const out = translateAll(items);
      out[bad].points = ["only one point"];   // wrong length
      return out;
    });
    const r = await tr([good, bad]);
    expect(r.status).toBe(200);
    expect(r.body.translations[good]).toBeTruthy();
    expect(r.body.translations[bad]).toBeUndefined();
    expect(r.body.failed).toEqual([bad]);
  });

  it("a failed AI call gives its budget unit back", async () => {
    vi.stubEnv("LESSON_TRANSLATE_PER_HOUR", "1");
    const id = addCard(mcq(EN_ONLY));
    fakeModel(() => "not json at all");
    expect((await tr([id])).status).toBe(502);
    const calls = fakeModel((user) => translateAll(JSON.parse(user)));
    expect((await tr([id])).status).toBe(200);     // the single unit was refunded
    expect(calls.length).toBe(1);
  });

  it("an unparseable model reply fails every card with 502", async () => {
    const id = addCard(mcq(EN_ONLY));
    fakeModel(() => "this is not json");
    const r = await tr([id]);
    expect(r.status).toBe(502);
    expect(r.body.error).toBe("translation_failed");
  });

  it("the study-plan note is kept per learner and translated on request", async () => {
    const seq = [];
    vi.stubGlobal("fetch", vi.fn(async (url, init) => {
      const body = JSON.parse(init.body);
      const sys = body.messages[0].content;
      const reply = sys.startsWith("Translate this short") ? "Translated note" : "Keep going, you are close.";
      seq.push(sys.slice(0, 20));
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: reply } }] }) };
    }));
    const gen = await request(app).post("/api/learn/study-plan?lang=fa").set(A(learner)).send({ examDate: null, minutesPerDay: 60, useAi: true, lang: "fa" });
    expect(gen.status).toBe(200);
    expect(gen.body.aiNoteLang).toBe("fa");
    expect(gen.body.aiNoteHash).toMatch(/^[0-9a-f]{32}$/);
    const get = await request(app).get("/api/learn/study-plan?lang=en").set(A(learner));
    expect(get.body.aiNoteLang).toBe("fa");
    const t = await request(app).post("/api/learn/study-plan/translate").set(A(learner)).send({ to: "en" });
    expect(t.status).toBe(200);
    expect(t.body.text).toBe("Translated note");
    const same = await request(app).post("/api/learn/study-plan/translate").set(A(learner)).send({ to: "fa" });
    expect(same.body.same).toBe(true);
  });
});

describe("VP micro-lesson personalization is kept", () => {
  it("the AI prompt carries this student's failed history and approach items", async () => {
    let captured = null;
    vi.stubGlobal("fetch", vi.fn(async (url, init) => {
      captured = JSON.parse(init.body).messages;
      const micro = "### درس\n" + "متن آموزشی شخصی‌سازی‌شده. ".repeat(6);
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify({ strengths: [], weaknesses: [], missed: [], commonMistakes: [], suggestion: "تمرین", microlearning: micro }) } }] }) };
    }));
    const base = {
      score: 40, sectionScores: {}, orderReview: { appropriate: [], unnecessary: [], missedKey: [] },
      missed: [], strengths: [], weaknesses: [], commonMistakes: [], suggestion: "",
      results: [
        { section: "history", label: "پرسیدن زمان شروع درد", done: false, reason: "ثبت نشد" },
        { section: "history", label: "سابقهٔ دارویی", done: true, reason: "" },
        { section: "management", label: "رویکرد اولیه برای ACS", done: false, reason: "" },
      ],
    };
    const session = { messages: [{ role: "student", text: "سلام" }], problemList: ["درد قفسه سینه"], ddx: ["ACS"], tests: [], imaging: [], finalDx: "ACS" };
    const out = await enrichEvaluationWithLLM({
      base, caseData: { diagnosis_fa: "ACS", diagnosis_en: "ACS" }, session, lang: "fa",
      prompts: { evaluator_fa: "E", micro_fa: "M", evaluator_en: "E", micro_en: "M" },
      aiCfg: resolveAiConfig({ provider: "OpenRouter", model: "test/free", apiKey: "synthetic-only" }), scope: "overall",
    });
    const user = captured.at(-1).content;
    expect(user).toContain("پرسیدن زمان شروع درد");     // the failed history item
    expect(user).toContain("رویکرد اولیه برای ACS");      // the failed approach item
    expect(user).toContain("درد قفسه سینه");             // this student's problem list
    expect(out.microlearning).toMatch(/درس/);
  });
});
