// Round 68 bug hunt — regression tests for the bugs found by the broad sweep.
// (1) Learn-path curation crashed ("Cannot read properties of null (reading
//     'find')") as soon as a past-exam card belonged to a basic-science topic
//     (anatomy, physio, …) that has no syllabus. Those cards now fall back to
//     the booklet/subject grouping and the run completes.
// (2) Mindmap-bank input errors answered 500. They now answer 400 (bad input),
//     404 (missing mindmap / source) or 409 (slug taken).
// (3) errorHandler hid even deliberate 4xx messages in production. 4xx messages
//     are now returned; 5xx details stay hidden outside development.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "child_process";
import request from "supertest";
import { initDb, db } from "../src/db.js";
import { createApp } from "../src/app.js";
import { curateOfficialPath } from "../src/lib/pathcurator.js";
import { syllabusFor } from "../src/data/path-syllabus.js";
import { errorHandler } from "../src/lib/security.js";
import express from "express";

let app;
let insertedCardId = null;
const login = (u, p = "demo") => request(app).post("/api/auth/login").send({ username: u, password: p });

beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb();
  app = createApp();
});

afterAll(() => {
  if (insertedCardId) db.prepare("DELETE FROM flashcards WHERE id=?").run(insertedCardId);
});

describe("R68 bug 1: curation survives a topic without a syllabus", () => {
  it("anatomy has no syllabus (the precondition of the bug)", () => {
    expect(syllabusFor("anatomy")).toBeFalsy();
  });

  it("a past-exam card on anatomy no longer crashes curateOfficialPath", () => {
    const topic = db.prepare("SELECT id, slug FROM topics WHERE slug='anatomy'").get();
    expect(topic).toBeTruthy();
    const d = {
      track: "learn",
      topic: "anatomy",
      q_fa: "کدام عصب قلب را عصب‌دهی پاراسمپاتیک می‌کند؟ (R68 تست باگ)",
      q_en: "Which nerve gives parasympathetic supply to the heart? (R68 bug test)",
      options_fa: ["الف", "ب", "ج", "د"],
      options_en: ["a", "b", "c", "d"],
      correct_index: 0,
      explanation_fa: "توضیح آزمایشی.",
      explanation_en: "Test explanation.",
      source_meta: {
        kind: "past_exam_import",
        subject_fa: "آناتومی", subject_en: "Anatomy",
        chapter_fa: "", chapter_en: "",
        exam_type: "پره‌انترنی", year: "۱۴۰۳", month: "خرداد", sitting: "main",
      },
    };
    const info = db.prepare("INSERT INTO flashcards (data_json, active) VALUES (?,1)").run(JSON.stringify(d));
    insertedCardId = Number(info.lastInsertRowid);
    let out;
    expect(() => { out = curateOfficialPath({ force: true }); }).not.toThrow();
    expect(out.ok).toBe(true);
  });
});

describe("R68 bug 2: mindmap-bank input errors are 4xx, not 500", () => {
  let A;
  beforeAll(async () => {
    const tk = (await login("admin")).body.token;
    A = { Authorization: `Bearer ${tk}` };
  });

  it("bad slug → 400 with the validation message", async () => {
    const r = await request(app).post("/api/admin/mindmap-bank").set(A)
      .send({ slug: "Bad Slug!", title_fa: "الف", title_en: "A", graph_json: { nodes: [], edges: [] } });
    expect(r.status).toBe(400);
    expect(r.body.message).toBe("slug must be [a-z0-9-]");
  });

  it("missing graph.nodes → 400", async () => {
    const r = await request(app).post("/api/admin/mindmap-bank").set(A)
      .send({ slug: "r68-bad-graph", title_fa: "الف", title_en: "A", graph_json: { edges: [] } });
    expect(r.status).toBe(400);
  });

  it("duplicate of a missing mindmap → 404", async () => {
    const r = await request(app).post("/api/admin/mindmap-bank/duplicate/no-such-map-r68").set(A).send({ newSlug: "r68-copy" });
    expect(r.status).toBe(404);
  });

  it("duplicate without newSlug → 400 (not a NULL insert crash)", async () => {
    const src = db.prepare("SELECT slug FROM mindmap_bank ORDER BY id LIMIT 1").get();
    if (!src) return; // no mindmaps seeded: nothing to duplicate
    const r = await request(app).post(`/api/admin/mindmap-bank/duplicate/${src.slug}`).set(A).send({});
    expect(r.status).toBe(400);
  });

  it("CSV import with no data rows → 400", async () => {
    const r = await request(app).post("/api/admin/mindmap-bank/import/csv").set(A).send({ csv: "slug,title_fa\n" });
    expect(r.status).toBe(400);
    expect(r.body.message).toBe("empty csv");
  });

  it("link without question_id → 400 (was NOT NULL constraint 500)", async () => {
    const r = await request(app).post("/api/admin/mindmap-bank/link").set(A).send({ mindmap_slug: "stem-acs-anterior" });
    expect(r.status).toBe(400);
    expect(r.body.message).toBe("question_id required");
  });

  it("link to a mindmap that does not exist → 404", async () => {
    const r = await request(app).post("/api/admin/mindmap-bank/link").set(A)
      .send({ question_id: 1, mindmap_slug: "no-such-map-r68" });
    expect(r.status).toBe(404);
  });

  it("link with a valid body still succeeds", async () => {
    const map = db.prepare("SELECT slug FROM mindmap_bank ORDER BY id LIMIT 1").get();
    if (!map) return;
    const r = await request(app).post("/api/admin/mindmap-bank/link").set(A)
      .send({ question_id: 987654, mindmap_slug: map.slug, weight: 2 });
    expect(r.status).toBe(200);
    db.prepare("DELETE FROM question_mindmap_links WHERE question_id=987654").run();
  });
});

describe("R68 bug 2b: learn-path curate with a null body", () => {
  it("POST /api/admin/learn-path/curate answers 200 without a body", async () => {
    const tk = (await login("admin")).body.token;
    const r = await request(app).post("/api/admin/learn-path/curate").set({ Authorization: `Bearer ${tk}` });
    expect(r.status).toBe(200);
  });
});

describe("R68 bug 3: errorHandler message visibility", () => {
  const prevEnv = process.env.NODE_ENV;
  const build = (status, message) => {
    const a = express();
    a.get("/x", (req, res, next) => { const e = new Error(message); e.status = status; next(e); });
    a.use(errorHandler);
    return a;
  };
  afterAll(() => { process.env.NODE_ENV = prevEnv; });

  it("in production a 4xx keeps its deliberate message", async () => {
    process.env.NODE_ENV = "production";
    const r = await request(build(400, "slug must be [a-z0-9-]")).get("/x");
    expect(r.status).toBe(400);
    expect(r.body.message).toBe("slug must be [a-z0-9-]");
  });

  it("in production a 5xx hides the internal message", async () => {
    process.env.NODE_ENV = "production";
    const r = await request(build(500, "no such table: secret")).get("/x");
    expect(r.status).toBe(500);
    expect(r.body.message).toBe("Something went wrong.");
  });
});

import { genderFromStudentName } from "../src/lib/patient-persona.js";
describe("R68 bug 4: a Latin name in the Persian name field is read as English", () => {
  it("Maryam Hosseini (in name_fa) → female; Ali Rezaei → male", () => {
    expect(genderFromStudentName({ name_fa: "Maryam Hosseini" })).toBe("female");
    expect(genderFromStudentName({ name_fa: "Ali Rezaei" })).toBe("male");
  });
  it("an unknown Latin name still gives null (no guessing)", () => {
    expect(genderFromStudentName({ name_fa: "Zzqx Yyvw" })).toBeNull();
  });
});
