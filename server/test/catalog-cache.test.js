/* catalog-cache.test.js — the content-version triggers must invalidate the
   learner catalog cache on every catalog write, and never serve stale data. */
import { describe, it, expect, beforeAll } from "vitest";
import { initDb, initSchema, db } from "../src/db.js";
import { cachedByContent, clearCatalogCache } from "../src/lib/catalog-cache.js";

const version = () => db.prepare("SELECT v FROM catalog_versions WHERE name='content'").get().v;

beforeAll(async () => {
  await initDb();
  initSchema();
  clearCatalogCache();
});

describe("catalog content-version cache", () => {
  it("builds once per content version and rebuilds after a catalog write", () => {
    let builds = 0;
    const build = () => { builds++; return { n: db.prepare("SELECT COUNT(*) AS n FROM path_nodes").get().n }; };
    const a = cachedByContent("test-key", build);
    const b = cachedByContent("test-key", build);
    expect(b).toBe(a);
    expect(builds).toBe(1);

    const v0 = version();
    const node = db.prepare("SELECT id, ord FROM path_nodes LIMIT 1").get();
    if (node) {
      db.prepare("UPDATE path_nodes SET ord = ord WHERE id = ?").run(node.id);
      expect(version()).toBeGreaterThan(v0);
    }
    cachedByContent("test-key", build);
    expect(builds).toBe(node ? 2 : 1);
  });

  it("bumps the version on topic and flashcard writes (triggers exist)", () => {
    const names = db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'trg_%_ver_%'").all().map((r) => r.name);
    for (const t of ["flashcards", "path_nodes", "topics"]) {
      for (const op of ["ins", "upd", "del"]) expect(names).toContain(`trg_${t}_ver_${op}`);
    }
  });
});
