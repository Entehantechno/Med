// R97: the learner home uses the SVG icon set, not emoji. Emoji render as empty boxes on
// some Persian system fonts and clash with the rest of the calm UI. The "✓" check mark is
// plain text and is allowed.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, "LearnHome.jsx"), "utf8");

describe("LearnHome icons (R97)", () => {
  it("contains no pictographic emoji", () => {
    const hits = [...src.matchAll(/\p{Extended_Pictographic}/gu)].map((m) => m[0]);
    expect(hits).toEqual([]);
  });

  it("uses the shared Icon component for the replaced glyphs", () => {
    for (const name of ["party", "warn", "compass", "target", "strength", "gift"]) {
      expect(src).toContain(`name="${name}"`);
    }
  });
});
