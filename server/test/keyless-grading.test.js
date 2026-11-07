// Keyless master-bank items (multi-answer or low-confidence keys) must never be
// graded. The source JSON still carries a guessed `correct_index` on some rows;
// the import path has to ignore it. This test reads the real files and fails if
// any keyless row produces a correct option or a gradeable card.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { officialQuestionIsKeyless, normalizeOfficialQuestion } from "../src/routes/admin.js";
import { cardIsKeyless } from "../src/lib/cardfacets.js";

const here = dirname(fileURLToPath(import.meta.url));
const bankDir = join(here, "..", "..", "tools", "master-bank");

function keylessRows() {
  const rows = [];
  for (const name of readdirSync(bankDir).filter((n) => /^import-payload\..*\.json$/.test(n))) {
    const body = JSON.parse(readFileSync(join(bankDir, name), "utf8"));
    const qs = Array.isArray(body) ? body : body.questions;
    if (!Array.isArray(qs)) continue;
    qs.forEach((q, i) => { if (q && q.keyless === true) rows.push({ name, n: i + 1, q }); });
  }
  return rows;
}

describe("keyless master-bank rows are never graded", () => {
  const rows = keylessRows();

  it("finds the keyless rows in the bank", () => {
    expect(rows.length).toBeGreaterThan(0);
  });

  it("every keyless row is treated as keyless even when correct_index is set", () => {
    const withGuess = rows.filter((r) => r.q.correct_index != null);
    expect(withGuess.length).toBeGreaterThan(0); // documents the stale guessed indexes
    for (const r of rows) expect(officialQuestionIsKeyless(r.q), `${r.name}:${r.n}`).toBe(true);
  });

  it("normalized cards have no correct option and are not gradeable", () => {
    for (const r of rows) {
      const card = normalizeOfficialQuestion(r.q, {});
      const correct = (card.options || []).filter((o) => o && o.correct);
      expect(correct.length, `${r.name}:${r.n} has a correct option`).toBe(0);
      expect(cardIsKeyless(card), `${r.name}:${r.n} not marked keyless`).toBe(true);
    }
  });
});
