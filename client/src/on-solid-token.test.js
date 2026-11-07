/* R100: text colour on solid fills uses `var(--on-solid)`, not a raw white. The token has the
   same value in both themes, so the migration does not change pixels (checked with screenshots).
   This guard fails if a raw `color: #fff` / `color: "#fff"` comes back in the client source. */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(css|jsx?)$/.test(name) && !/\.test\.jsx?$/.test(name)) out.push(p);
  }
  return out;
}

describe("--on-solid token (R100)", () => {
  it("the token is defined once, as white, with no dark override", () => {
    const css = readFileSync(join(here, "design-refresh.css"), "utf8");
    expect(css).toMatch(/:root\s*\{[^}]*--on-solid:\s*#ffffff/);
    // every rule that declares --on-solid must be the :root rule (no dark override)
    const selectors = [...css.matchAll(/([^{}]+)\{[^{}]*--on-solid\s*:/g)].map((m) => m[1].trim().split(/\s+/).pop());
    expect(selectors.length).toBeGreaterThan(0);
    expect(selectors.every((sel) => sel === ":root")).toBe(true);
  });

  it("--header is never used as a text colour (it is the navy header background)", () => {
    const offenders = [];
    for (const file of walk(here)) {
      if (/\.test\.jsx?$/.test(file)) continue;
      if (/color\s*:\s*var\(--header\)/.test(readFileSync(file, "utf8"))) offenders.push(relative(here, file));
    }
    expect(offenders).toEqual([]);
    const css = readFileSync(join(here, "design-refresh.css"), "utf8");
    expect(css).toMatch(/--header-ink:\s*#eaf1ff/);
  });

  it("no raw text-colour white remains in the client source", () => {
    const offenders = [];
    const cssRe = /(?<![-\w])color\s*:\s*#(?:fff|ffffff)(?![\w-])/i;
    const jsxRe = /(?<![A-Za-z_])color\s*:\s*(["'])#(?:fff|ffffff)\1/;
    for (const file of walk(here)) {
      const text = readFileSync(file, "utf8");
      if (cssRe.test(text) || jsxRe.test(text)) offenders.push(relative(here, file));
    }
    expect(offenders).toEqual([]);
  });
});
