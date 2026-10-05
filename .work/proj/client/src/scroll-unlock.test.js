import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useScrollLock } from "./utils/useScrollLock.js";

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(here, name), "utf8");

describe("document scrolling is not trapped", () => {
  it("ships a last-loaded unlock stylesheet that restores the document scroller", () => {
    const css = read("scroll-unlock.css");
    expect(css).toMatch(/overflow-y:\s*scroll\s*!important/);
    expect(css).toMatch(/body\s*\{[^}]*overflow:\s*visible\s*!important/s);
    expect(css).toMatch(/#root/);
    expect(css).toMatch(/\.landing/);
    expect(css).toMatch(/html\.overlay-open/);
    expect(css).toMatch(/\.login-modal-overlay/);
  });

  it("is imported after the other stylesheets in main.jsx", () => {
    const main = read("main.jsx");
    const unlock = main.indexOf('import "./scroll-unlock.css"');
    const speed = main.indexOf('import "./styles-speed-fixes.css"');
    const mobile = main.indexOf('import "./mobile-learn.css"');
    expect(unlock).toBeGreaterThan(-1);
    expect(unlock).toBeGreaterThan(speed);
    expect(unlock).toBeGreaterThan(mobile);
  });

  it("does not make html and body dual overflow-y scrollports", () => {
    const speed = read("styles-speed-fixes.css");
    expect(speed).not.toMatch(/html,body\{[^}]*overflow-y:auto/);
    const styles = read("styles.css");
    expect(styles).not.toMatch(/overflow-x:clip;overflow-y:auto/);
  });

  it("refcounts overlay-open so nested modals do not unlock too early", () => {
    const root = document.documentElement;
    root.classList.remove("overlay-open");
    const a = renderHook(() => useScrollLock(true));
    expect(root.classList.contains("overlay-open")).toBe(true);
    const b = renderHook(() => useScrollLock(true));
    expect(root.classList.contains("overlay-open")).toBe(true);
    a.unmount();
    expect(root.classList.contains("overlay-open")).toBe(true);
    b.unmount();
    expect(root.classList.contains("overlay-open")).toBe(false);
  });
});
