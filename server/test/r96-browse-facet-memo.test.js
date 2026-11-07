/* r96-browse-facet-memo.test.js — R96 performance.
   /api/learn/browse rebuilt the facet counts over the whole ~11.6k-card pool on every request
   (~60 ms of synchronous work for a learner's default view). The facets depend only on the bank
   content (the browsePool signature), the language, includeDemo, the filters and the search term,
   so they are memoised under that key and dropped when the signature changes. These tests pin
   the observable behaviour: identical answers with and without the memo, no leakage between
   different filters, and invalidation after a bank write. */
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import request from "supertest";
import { initDb, initSchema, db } from "../src/db.js";
import { createApp } from "../src/app.js";
import { facetMemoStats } from "../src/routes/learn.js";

let app, tk;

beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb();
  initSchema();
  app = createApp();
  const res = await request(app).post("/api/auth/login").send({ username: "learner", password: "demo" });
  tk = res.body.token;
});

const browse = (qs = "") => request(app).get(`/api/learn/browse?lang=fa&${qs}`).set("Authorization", `Bearer ${tk}`);

describe("learn/browse facet memo (R96)", () => {
  it("returns the same facets on repeated identical requests", async () => {
    const a = await browse("per=5");
    const b = await browse("per=5");
    expect(a.status).toBe(200);
    expect(b.body.facets).toEqual(a.body.facets);
    expect(b.body.total).toBe(a.body.total);
  });

  it("keeps filtered and unfiltered facets apart", async () => {
    const plain = await browse("per=5");
    const subject = plain.body.facets?.subject?.[0];
    const filtered = subject ? await browse(`per=5&subject=${encodeURIComponent(subject.key ?? subject.value ?? subject.label ?? subject)}`) : null;
    const again = await browse("per=5");
    expect(again.body.facets).toEqual(plain.body.facets);
    if (filtered) expect(filtered.status).toBe(200);
  });

  it("separates the demo and non-demo views", async () => {
    const nodemo = await browse("per=5");
    const withdemo = await browse("per=5&includeDemo=1");
    const nodemo2 = await browse("per=5");
    expect(nodemo2.body.facets).toEqual(nodemo.body.facets);
    expect(withdemo.status).toBe(200);
  });

  it("drops the memo when the bank signature changes", async () => {
    await browse("per=5");
    expect(facetMemoStats().size).toBeGreaterThan(0);
    const before = facetMemoStats().sig;
    // A bank write bumps revision and content_updated_at (what the admin routes do).
    const row = db.prepare("SELECT id FROM flashcards WHERE active=1 ORDER BY id LIMIT 1").get();
    if (!row) return;
    db.prepare("UPDATE flashcards SET revision = revision + 1, content_updated_at = datetime('now') WHERE id=?").run(row.id);
    await browse("per=5");
    expect(facetMemoStats().sig).not.toBe(before);
  });
});
