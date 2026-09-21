import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const here = dirname(fileURLToPath(import.meta.url));
const adminSrc = readFileSync(join(here, "../src/routes/admin.js"), "utf8");

describe("admin is law: official import must not undo deletes", () => {
  it("counts fingerprints on every card, including inactive ones", () => {
    const start = adminSrc.indexOf("function officialExistingFingerprints");
    expect(start).toBeGreaterThan(0);
    const chunk = adminSrc.slice(start, start + 450);
    expect(chunk).toMatch(/Include inactive rows/);
    expect(chunk).toMatch(/SELECT data_json FROM flashcards/);
    expect(chunk).not.toMatch(/WHERE active=1/);
  });

  it("does not recreate a tombstoned lesson title", () => {
    expect(adminSrc).toMatch(/if \(!topic\?\.id \|\| topic\.tombstoned\) return null/);
    expect(adminSrc).toMatch(/if \(nodeIsTombstoned\(topic, title_fa, title_en\)\) return null/);
    expect(adminSrc).toMatch(/if \(found\) return found/);
  });

  it("tombstones old titles on rename and never the live node id", () => {
    expect(adminSrc).toMatch(/tombstone\("node", `\$\{slug\}:\$\{n\.title_fa\}`\)/);
    expect(adminSrc).toMatch(/Never tombstone the node id/);
  });

  it("will not revive an admin-deleted lesson", () => {
    expect(adminSrc).toMatch(/if \(nodeIsTombstoned\(topic, r\.title_fa, r\.title_en, r\.id\)\) continue/);
  });

  it("routes a deleted subject or lesson to bank_only instead of attaching", () => {
    expect(adminSrc).toMatch(/if \(!topic\?\.id \|\| topic\.tombstoned\)/);
    expect(adminSrc).toMatch(/d\.source_meta\.route = "bank_only"/);
  });
});
