import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// R86 regression guard: a `padding:` shorthand placed after `...wrap(wide)` in the
// same style object erased the horizontal gutter on mobile (text touched the edges).
describe("VirtualPatientPage layout guard", () => {
  const src = readFileSync(join(process.cwd(), "src", "pages", "VirtualPatientPage.jsx"), "utf8");
  const lines = src.split("\n");

  it("does not override wrap() side padding with a padding shorthand", () => {
    // \bpadding: matches only the shorthand; paddingTop:/paddingLeft: have no colon right after "padding".
    const offenders = lines
      .map((l, i) => ({ l, n: i + 1 }))
      .filter(({ l }) => (l.includes("...wrap(") || l.includes("...sectionPad")) && /\bpadding:/.test(l));
    expect(offenders.map((o) => o.n)).toEqual([]);
  });

  it("sectionPad uses vertical longhands only", () => {
    const pad = lines.find((l) => l.trimStart().startsWith("const sectionPad ="));
    expect(pad).toBeTruthy();
    expect(pad).not.toMatch(/\bpadding:/);
  });

  it("wrap() sets horizontal padding with longhands", () => {
    const wrapLine = lines.find((l) => l.startsWith("const wrap = "));
    expect(wrapLine).toMatch(/paddingLeft:/);
    expect(wrapLine).toMatch(/paddingRight:/);
  });
});
