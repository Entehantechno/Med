/* ================================================================
   pathcurator.test.js — round 5 path:
   1. every official question is classified into a standard syllabus
      chapter; each chapter becomes nodes of ≤15 questions with fa+en titles,
   2. every path question is FREE (no premium question tier),
   3. each question carries a passport (exam type + month + year),
   4. the premium library (bank search) stays a premium perk.
   ================================================================ */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "child_process";
import request from "supertest";
import { initDb, db, persistNow } from "../src/db.js";
import { createApp } from "../src/app.js";
import { commitOfficialImport } from "../src/routes/admin.js";
import { splitFreePremium, curateOfficialPath } from "../src/lib/pathcurator.js";

let app;
async function token(u, p = "demo") {
  return (await request(app).post("/api/auth/login").send({ username: u, password: p })).body.token;
}
const A = (tk) => ({ Authorization: `Bearer ${tk}` });
const MARK = "زیکوریتور";

function q(i, { subject, subjectEn, chapter, chapterEn, examType, year }) {
  // NOTE: the importer fingerprint collapses digit runs, so the per-question
  // uniqueness must come from a letter token, not the question number.
  const token = "گ".repeat(i + 1);
  return {
    question_no: i,
    question_fa: `سؤال آزمایشی ${MARK} با نشانهٔ یکتای ${token} دربارهٔ ${chapter}؟`,
    question_en: `Curator test question unique token ${"z".repeat(i + 1)} about ${chapterEn}`,
    options_fa: ["الف", "ب", "ج", "د"],
    options_en: ["a", "b", "c", "d"],
    correct_index: i % 4,
    options_why_fa: ["درست/غلط", "درست/غلط", "درست/غلط", "درست/غلط"],
    explanation_fa: `توضیح کامل درسنامه‌ای سؤال ${i} برای پوشش مسیر.`,
    explanation_en: `Full rationale for question ${i}.`,
    subject_fa: subject, subject_en: subjectEn,
    chapter_fa: chapter, chapter_en: chapterEn || chapter,
    year, month: "خرداد", sitting: "main", exam_type: examType,
  };
}

beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb();
  app = createApp();

  const questions = [];
  let n = 0;
  // 25 neurology questions for ONE chapter → curated stage (10) + premium (15)
  for (let i = 0; i < 25; i++) questions.push(q(++n, {
    subject: "نورولوژی", subjectEn: "Neurology", chapter: `سردرد ${MARK}`,
    chapterEn: "Headache test", examType: i % 2 ? "preinternship" : "پره‌انترنی", year: "۱۴۰۳",
  }));
  // internal-medicine questions routed by chapter prefix to seeded sub-topics
  const internals = [
    ["خون / ITP", "Heme / ITP", "heme"],
    ["ریه / آسم", "Lung / asthma", "pulmo"],
    ["قلب / STEMI", "Heart / STEMI", "cardio"],
  ];
  for (const [chapter, chapterEn] of internals) {
    for (let i = 0; i < 4; i++) questions.push(q(++n, {
      subject: "داخلی", subjectEn: "Internal Medicine", chapter: `${chapter} ${MARK}`,
      chapterEn: `${chapterEn} test`, examType: "preinternship", year: "۱۴۰۲",
    }));
  }
  // a brand-new subject with only 3 questions → still gets a covered stage
  for (let i = 0; i < 3; i++) questions.push(q(++n, {
    subject: `درس نو ${MARK}`, subjectEn: "Curator New Subject", chapter: `فصل نو ${MARK}`,
    chapterEn: "New chapter", examType: "پره‌انترنی", year: "۱۴۰۱",
  }));

  const res = commitOfficialImport({ program: "preint", maxPerLesson: 15, questions }, null);
  expect(res.inserted).toBe(questions.length);
  global.__curatorInserted = res.inserted;
});

afterAll(() => {
  // remove every test card, then the test stages and the synthetic topic
  const ids = [];
  for (const c of db.prepare("SELECT id, data_json FROM flashcards").all()) {
    let d; try { d = JSON.parse(c.data_json); } catch { continue; }
    if (JSON.stringify(d).includes(MARK)) ids.push(c.id);
  }
  const tx = db.transaction(() => {
    for (const n of db.prepare("SELECT id, card_ids FROM path_nodes").all()) {
      let list = []; try { list = JSON.parse(n.card_ids || "[]"); } catch { /* */ }
      const kept = list.filter((id) => !ids.includes(id));
      if (kept.length !== list.length) {
        db.prepare("UPDATE path_nodes SET card_ids=? WHERE id=?").run(JSON.stringify(kept), n.id);
      }
      const title = String(db.prepare("SELECT title_fa FROM path_nodes WHERE id=?").get(n.id)?.title_fa || "");
      if ((kept.length === 0 && title.includes(MARK)) || title.includes(MARK)) {
        db.prepare("DELETE FROM path_nodes WHERE id=?").run(n.id);
      }
    }
    const t = db.prepare("SELECT id FROM topics WHERE name_fa LIKE ?").get(`%${MARK}%`);
    if (t) db.prepare("DELETE FROM topics WHERE id=?").run(t.id);
    for (const id of ids) {
      db.prepare("DELETE FROM flashcards WHERE id=?").run(id);
      db.prepare("DELETE FROM card_revisions WHERE card_id=?").run(id);
    }
    // do not leak premium state into later test files (shared SQLite)
    const learner = db.prepare("SELECT id FROM users WHERE username='learner'").get();
    if (learner) db.prepare("UPDATE learner_profiles SET premium=0, premium_until=NULL WHERE user_id=?").run(learner.id);
  });
  tx();
  persistNow();
});

describe("path curator (round 5): syllabus chapters, ≤15 questions per node, all free", () => {
  it("classifies a chapter's questions into titled syllabus nodes of at most 15, none premium", () => {
    const out = curateOfficialPath({ force: true });
    expect(out.ok).toBe(true);
    expect(out.premiumCards).toBeGreaterThan(0);   // round 7: «تمرین بیشتر 👑» extras
    expect(out.topicsCovered).toBeGreaterThanOrEqual(4); // neuro + 3 internal + new subject

    const neuro = db.prepare("SELECT id FROM topics WHERE slug='neuro' AND program='preint'").get();
    const rows = db.prepare("SELECT id, data_json FROM flashcards").all();
    const testIds = new Set();
    for (const r of rows) {
      let d; try { d = JSON.parse(r.data_json); } catch { continue; }
      if ((d.q_fa || "").includes(`سردرد ${MARK}`)) {
        testIds.add(r.id);
        expect(d.source_meta.route).toBe("competitive_path");
        expect(d.source_meta.exam_type).toBe("پره‌انترنی"); // canonical vocabulary
      }
    }
    expect(testIds.size).toBe(25);
    const nodes = db.prepare("SELECT * FROM path_nodes WHERE topic_id=? AND active=1 AND curated=1").all(neuro.id)
      .filter((n) => JSON.parse(n.card_ids).some((id) => testIds.has(id)));
    expect(nodes.length).toBeGreaterThanOrEqual(2);       // 25 questions never fit one node
    // round 7: free core node(s) of ≤15 + a locked premium «تمرین بیشتر» node
    const freeNodes = nodes.filter((n) => !n.premium), premNodes = nodes.filter((n) => n.premium);
    expect(freeNodes.length).toBeGreaterThanOrEqual(1);
    expect(premNodes.length).toBe(1);
    expect(premNodes[0].title_fa).toContain("تمرین بیشتر");
    const premIds = new Set(premNodes.flatMap((n) => JSON.parse(n.card_ids)));
    for (const r of rows) {
      if (!testIds.has(r.id)) continue;
      const d = JSON.parse(r.data_json);
      expect(!!d.premium).toBe(premIds.has(r.id));      // premium flag == owned by a premium node
    }
    let covered = 0;
    for (const n of nodes) {
      const ids = JSON.parse(n.card_ids);
      expect(ids.length).toBeLessThanOrEqual(15);
      expect(n.title_fa).toMatch(/سردرد/);               // syllabus chapter title, not a booklet label
      expect(n.title_en).toMatch(/Headache/i);
      expect(n.subtitle_fa).toContain("۱۴۰۳");            // exam-year span explicit
      covered += ids.filter((id) => testIds.has(id)).length;
    }
    expect(covered).toBe(25);
  });

  it("routes internal-medicine chapters to the seeded sub-topics (no parallel umbrella topic)", () => {
    for (const [slug, prefix] of [["heme", "خون"], ["pulmo", "ریه"], ["cardio", "قلب"]]) {
      const topic = db.prepare("SELECT id FROM topics WHERE slug=? AND program='preint'").get(slug);
      const cardRows = db.prepare("SELECT id, data_json FROM flashcards").all().filter((r) => {
        let d; try { d = JSON.parse(r.data_json); } catch { return false; }
        return (d.source_meta?.chapter_fa || "").startsWith(prefix) && (d.q_fa || "").includes(MARK);
      });
      expect(cardRows.length).toBe(4);
      cardRows.forEach((r) => expect(JSON.parse(r.data_json).topic).toBe(slug));
      // and the sub-topic has a live curated stage holding those cards
      const ids = new Set(cardRows.map((r) => r.id));
      const nodes = db.prepare("SELECT title_fa, card_ids, curated FROM path_nodes WHERE topic_id=? AND active=1").all(topic.id);
      expect(nodes.some((n) => n.curated && JSON.parse(n.card_ids).some((id) => ids.has(id)))).toBe(true);
    }
    const umbrella = db.prepare("SELECT id FROM topics WHERE slug='official-internal-medicine' AND active=1").get();
    expect(umbrella).toBeFalsy();
  });

  it("covers even a tiny brand-new subject with an explicit stage", () => {
    const t = db.prepare("SELECT id FROM topics WHERE name_fa LIKE ?").get(`%درس نو ${MARK}%`);
    expect(t).toBeTruthy();
    const n = db.prepare("SELECT * FROM path_nodes WHERE topic_id=? AND active=1").get(t.id);
    expect(n).toBeTruthy();
    expect(JSON.parse(n.card_ids).length).toBe(3);
    expect(n.title_fa).toBeTruthy();
    expect(n.title_en).toBeTruthy();
  });

  it("is idempotent — a second run yields the same stages/cards without duplication", () => {
    const before = db.prepare("SELECT COUNT(*) n FROM path_nodes WHERE curated=1").get().n;
    const out = curateOfficialPath({ force: true });
    const after = db.prepare("SELECT COUNT(*) n FROM path_nodes WHERE curated=1").get().n;
    expect(after).toBe(before);
    expect(out.pathCards).toBeGreaterThan(0);
  });
});

describe("learner-facing rules over the curated bank", () => {
  it("the path payload exposes each stage subtitle and the residency/pre-internship passport", async () => {
    const ltk = await token("learner");
    const d = (await request(app).get("/api/learn/path").set(A(ltk))).body;
    const neuro = d.topics.find((t) => t.slug === "neuro");
    const stage = neuro.nodes.find((n) => n.title.includes("سردرد"));
    expect(stage).toBeTruthy();
    expect(stage.subtitle).toBeTruthy();
    expect(stage.cards).toBeLessThanOrEqual(15);
    // opening the lesson returns a passport per question (exam type + month + year)
    const lesson = await request(app).get(`/api/learn/lesson/${stage.id}`).set(A(ltk));
    expect(lesson.status).toBe(200);
    const withSource = lesson.body.cards.filter((c) => c.source);
    expect(withSource.length).toBeGreaterThan(0);
    withSource.forEach((c) => expect(c.source).toMatch(/پره.انترنی/));
  });

  it("free learners: the path lesson is open, but bank browse/search stays a premium perk (3 teasers)", async () => {
    const ltk = await token("learner");
    const list = (await request(app).get(`/api/learn/browse?chapter=${encodeURIComponent("سردرد زیکوریتور")}`).set(A(ltk))).body;
    expect(list.premiumRequired).toBe(true);
    expect(list.cards.length).toBeLessThanOrEqual(3);
    expect(list.bankTotal).toBe(25);
    // a bank card outside the teasers is 402 in browse…
    const teasers = new Set(list.cards.map((c) => c.id));
    const rows = db.prepare("SELECT id, data_json FROM flashcards").all();
    const locked = rows.find((r) => r.data_json.includes(`سردرد ${MARK}`) && !teasers.has(r.id));
    expect(locked).toBeTruthy();
    expect((await request(app).get(`/api/learn/browse/${locked.id}`).set(A(ltk))).status).toBe(402);
    // …yet the very same question is studied for free inside its path lesson
    const path = (await request(app).get("/api/learn/path").set(A(ltk))).body;
    const neuro = path.topics.find((t) => t.slug === "neuro");
    const stages = neuro.nodes.filter((n) => n.title.includes("سردرد"));
    const freeStages = stages.filter((n) => !n.premium), premStages = stages.filter((n) => n.premium);
    expect(premStages.length).toBe(1);
    expect(premStages[0].premiumLocked).toBe(true);
    // the premium stage never gates the sequence and is 403 for a free learner
    expect((await request(app).get(`/api/learn/lesson/${premStages[0].id}`).set(A(ltk))).status).toBe(403);
    expect((await request(app).post(`/api/learn/lesson/${premStages[0].id}/finish`).set(A(ltk)).send({ correct: 1, total: 1 })).status).toBe(403);
    const lessons = await Promise.all(freeStages.map((n) => request(app).get(`/api/learn/lesson/${n.id}`).set(A(ltk))));
    for (const r of lessons) expect(r.status).toBe(200);
    const lessonIds = new Set(lessons.flatMap((r) => r.body.cards.map((c) => c.id)));
    expect(lessonIds.size).toBeGreaterThanOrEqual(15);
    for (const id of lessonIds) expect(new Set(premStages.flatMap(() => [])).has(id)).toBe(false);
    // premium library (bank search/filter) stays a premium perk
    const lib = await request(app).get("/api/learn/library").set(A(ltk));
    expect(lib.status).toBe(402);
  });

  it("free core covers EVERY sub-topic of a chapter; premium gets only repeats", () => {
    const chapter = { slug: "x", kw: ["migraine", "cluster", "tension", "rare"] };
    const mk = (id, q) => ({ id, d: { q_fa: q } });
    const list = [];
    for (let i = 0; i < 30; i++) list.push(mk(i + 1, "migraine case " + i));
    for (let i = 0; i < 6; i++) list.push(mk(100 + i, "cluster headache " + i));
    list.push(mk(200, "tension type"));
    list.push(mk(201, "a rare one"));
    const { free, premium } = splitFreePremium(list, 0.5, chapter);
    const has = (arr, w) => arr.some((c) => c.d.q_fa.includes(w));
    for (const w of ["migraine", "cluster", "tension", "rare"]) expect(has(free, w)).toBe(true);
    expect(free.length).toBeGreaterThanOrEqual(19);
    expect(premium.length).toBeGreaterThan(0);
    // premium never holds a sub-topic missing from the free core
    for (const w of ["migraine", "cluster", "tension", "rare"]) if (has(premium, w)) expect(has(free, w)).toBe(true);
    // small chapters stay fully free
    expect(splitFreePremium(list.slice(0, 18), 0.5, chapter).premium.length).toBe(0);
  });

  it("premium cards are exactly those owned by premium nodes (never unplaced ones)", () => {
    const premNodeIds = new Set();
    for (const n of db.prepare("SELECT card_ids FROM path_nodes WHERE active=1 AND premium=1").all()) JSON.parse(n.card_ids).forEach((id) => premNodeIds.add(id));
    for (const r of db.prepare("SELECT id, data_json FROM flashcards WHERE active=1").all()) {
      let d; try { d = JSON.parse(r.data_json); } catch { continue; }
      if (d.source_meta?.kind !== "past_exam_import") continue;
      expect(!!d.premium).toBe(premNodeIds.has(r.id));
    }
  });

  it("premium library covers the full bank", async () => {
    const learner = db.prepare("SELECT id FROM users WHERE username='learner'").get();
    db.prepare("UPDATE learner_profiles SET premium=1, premium_until='2030-01-01' WHERE user_id=?").run(learner.id);
    persistNow();
    const ltk = await token("learner");
    const lib = await request(app).get("/api/learn/library").set(A(ltk));
    expect(lib.status).toBe(200);
    const neuroGroup = lib.body.categories.find((c) => /نورولوژی|مغز و اعصاب/.test(c.name));
    expect(neuroGroup).toBeTruthy();
    expect(neuroGroup.count).toBeGreaterThanOrEqual(25);
  });

  it("admin can re-trigger curation over HTTP", async () => {
    const atk = await token("admin");
    const r = await request(app).post("/api/admin/learn-path/curate").set(A(atk));
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
  });
});
