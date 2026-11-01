import { describe, it, expect } from "vitest";
import { dedupeOverriddenCss } from "../../scripts/css-dedupe.mjs";

const run = (css) => dedupeOverriddenCss(css).css.replace(/\s+/g, " ").trim();

describe("dedupeOverriddenCss", () => {
  it("drops an earlier declaration overridden by a later identical selector", () => {
    expect(run(".a{color:red;margin:0}.a{color:blue}")).toBe(".a{margin:0}.a{color:blue}");
  });
  it("removes an emptied rule", () => {
    expect(run(".a{color:red}.a{color:blue}")).toBe(".a{color:blue}");
  });
  it("keeps the earlier value when the later one is not important and the earlier is", () => {
    expect(run(".a{color:red !important}.a{color:blue}")).toBe(".a{color:red !important}.a{color:blue}");
  });
  it("lets a later !important override an earlier normal declaration", () => {
    expect(run(".a{color:red}.a{color:blue !important}")).toBe(".a{color:blue !important}");
  });
  it("keeps shorthand/longhand pairs (different property names)", () => {
    expect(run(".a{padding-top:1px}.a{padding:0}")).toBe(".a{padding-top:1px}.a{padding:0}");
  });
  it("keeps a fallback when the later value uses newer syntax", () => {
    expect(run(".a{color:#123}.a{color:color-mix(in srgb,red,blue)}")).toBe(".a{color:#123}.a{color:color-mix(in srgb,red,blue)}");
  });
  it("does not merge across different at-rule contexts", () => {
    expect(run("@media (min-width:1px){.a{color:red}}.a{color:blue}")).toBe("@media (min-width:1px){.a{color:red}}.a{color:blue}");
  });
  it("treats custom property names as case-sensitive", () => {
    expect(run(":root{--Muted:1}:root{--muted:2}")).toBe(":root{--Muted:1}:root{--muted:2}");
  });
  it("never touches keyframes", () => {
    expect(run("@keyframes k{from{opacity:0}from{opacity:1}}")).toBe("@keyframes k{from{opacity:0}from{opacity:1}}");
  });
});
