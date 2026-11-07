// R104 style guard. Values come from docs/design/DESIGN.md (R104) and the WCAG contrast measurements there.
// If a token changes, update the number here and in the doc together.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(here, p), "utf8");

function lum(hex) {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const f = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

describe("R104 tokens meet WCAG", () => {
  it("control boundary reaches 3:1 on the panel in both themes (1.4.11)", () => {
    expect(contrast("#7a879d", "#ffffff")).toBeGreaterThanOrEqual(3);
    expect(contrast("#6b7fa5", "#141d33")).toBeGreaterThanOrEqual(3);
  });
  it("solid green CTA fill gives the white label 4.5:1 (1.4.3)", () => {
    expect(contrast("#1a7a4c", "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });
  it("dark primary CTA uses dark ink above 4.5:1 on both gradient ends", () => {
    expect(contrast("#0b1020", "#4f93e8")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#0b1020", "#3f7fd6")).toBeGreaterThanOrEqual(4.5);
  });
  it("the stylesheet declares the R104 tokens", () => {
    const css = read("styles.css") + read("design-refresh.css");
    expect(css).toMatch(/--accent-btn:#1a7a4c/);
    expect(css).toMatch(/--control-line:#7a879d/);
    expect(css).toMatch(/\[data-theme="dark"\]\{ --control-line:#6b7fa5; \}/);
  });
});

describe("R104 learner home: one accent per screen", () => {
  const src = read("pages/learn/LearnHome.jsx");
  it("only the two placement cards keep a coloured side stripe", () => {
    const stripes = [...src.matchAll(/className="card[^"]*"[^>]*borderInlineStart/g)].map((m) => m[0]);
    expect(stripes.length).toBe(2);
    expect(stripes.every((s) => /placement-(offer|reco)/.test(s))).toBe(true);
  });
  it("the hero is the only solid primary CTA; list actions are outline buttons", () => {
    // hero + the two placement cards (the only status cards keep their own solid CTA); list actions are outline
    expect((src.match(/btn btn-primary/g) || []).length).toBe(3);
    for (const target of ["dxChallenge", "quests", "review"]) {
      expect(src).toMatch(new RegExp(`btn btn-ghost btn-sm" onClick=\\{\\(\\) => go\\("${target}"`));
    }
    expect(src).toMatch(/btn btn-ghost btn-sm" onClick=\{\(\) => setShowRewarded\(true\)\}/);
    expect(src).not.toMatch(/btn btn-accent/);
  });
});
