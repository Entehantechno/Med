// @vitest-environment jsdom
// R70 — client-side HTML sanitiser used by blog bodies, admin previews, banner titles and generated SVG.
import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "./safe-html.js";

describe("R70 sanitizeHtml", () => {
  it("removes scripts, event handlers and javascript: links but keeps ordinary markup", () => {
    const out = sanitizeHtml('<p>ok</p><img src="x" onerror="alert(1)"><script>alert(2)</script><a href="javascript:alert(3)">link</a><strong>b</strong>');
    expect(out).toContain("<p>ok</p>");
    expect(out).toContain("<strong>b</strong>");
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toMatch(/onerror/i);
    expect(out).not.toMatch(/javascript:/i);
  });

  it("drops iframes, forms and inline style attributes", () => {
    const out = sanitizeHtml('<iframe src="https://evil.example"></iframe><form action="/x"><input name="a"></form><p style="background:url(javascript:1)">t</p>');
    expect(out).not.toMatch(/<iframe/i);
    expect(out).not.toMatch(/<form/i);
    expect(out).not.toMatch(/style=/i);
    expect(out).toContain("<p>t</p>");
  });

  it("empty and nullish input give an empty string", () => {
    expect(sanitizeHtml("")).toBe("");
    expect(sanitizeHtml(null)).toBe("");
  });

  it("SVG profile keeps QR rectangles and strips script", () => {
    const out = sanitizeHtml('<svg xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="2" height="2"/><script>alert(1)</script></svg>', { svg: true });
    expect(out).toContain("<rect");
    expect(out).not.toMatch(/<script/i);
  });
});
