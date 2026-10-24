import { describe, it, expect } from "vitest";
import { computeKeyboardInset, keyboardCssState, installKeyboardCssVars, KEYBOARD_THRESHOLD_PX } from "./keyboard-viewport.js";

/* R53: the sign-in/sign-up modal must size itself to the band of the layout
   viewport that is still visible above the on-screen keyboard. */
describe("computeKeyboardInset", () => {
  it("reports no keyboard when the visual viewport is the full layout viewport", () => {
    expect(computeKeyboardInset(664, { height: 664, offsetTop: 0 })).toEqual({ covered: false, top: 0, height: 664 });
  });

  it("reports the visible band when the keyboard shrinks the visual viewport (resizes-visual)", () => {
    // iPhone-like: layout 664px, keyboard covers the bottom 334px, no scroll offset.
    expect(computeKeyboardInset(664, { height: 330, offsetTop: 0 })).toEqual({ covered: true, top: 0, height: 330 });
  });

  it("follows a Safari-style offsetTop shift when the page is pushed up to keep the focused field visible", () => {
    expect(computeKeyboardInset(664, { height: 330, offsetTop: 120 })).toEqual({ covered: true, top: 120, height: 330 });
  });

  it("ignores small browser-chrome changes below the threshold (URL bar)", () => {
    const vv = { height: 664 - (KEYBOARD_THRESHOLD_PX - 10), offsetTop: 0 };
    expect(computeKeyboardInset(664, vv).covered).toBe(false);
  });

  it("treats a change just above the threshold as a keyboard", () => {
    const vv = { height: 664 - (KEYBOARD_THRESHOLD_PX + 5), offsetTop: 0 };
    expect(computeKeyboardInset(664, vv).covered).toBe(true);
  });

  it("falls back to the full layout viewport when visualViewport is unavailable", () => {
    expect(computeKeyboardInset(800, null)).toEqual({ covered: false, top: 0, height: 800 });
    expect(computeKeyboardInset(800, { height: NaN })).toEqual({ covered: false, top: 0, height: 800 });
  });

  it("never returns negative geometry", () => {
    const r = computeKeyboardInset(500, { height: -20, offsetTop: -5 });
    expect(r.top).toBeGreaterThanOrEqual(0);
    expect(r.height).toBeGreaterThanOrEqual(0);
  });
});

/* R54: global CSS variables published on <html> for every fixed/sticky text surface. */
describe("keyboardCssState", () => {
  it("gives inset 0 when no keyboard is shown", () => {
    expect(keyboardCssState(664, { height: 664, offsetTop: 0 })).toEqual({ covered: false, top: 0, height: 664, inset: 0 });
  });
  it("gives the distance from layout bottom to keyboard top (334px keyboard => inset 334)", () => {
    expect(keyboardCssState(664, { height: 330, offsetTop: 0 })).toEqual({ covered: true, top: 0, height: 330, inset: 334 });
  });
  it("accounts for a Safari offsetTop shift: hidden part = layout - (offsetTop + height)", () => {
    expect(keyboardCssState(664, { height: 330, offsetTop: 120 })).toEqual({ covered: true, top: 120, height: 330, inset: 214 });
  });
});

function fakeWindow(vv) {
  const listeners = {};
  const values = {};
  const root = {
    style: { setProperty: (k, v) => { values[k] = v; }, removeProperty: (k) => { delete values[k]; } },
    classList: {
      on: false,
      toggle(name, force) { this.on = force; },
      remove() { this.on = false; },
    },
  };
  if (vv) {
    vv.addEventListener = (t, f) => { (listeners[t] ||= []).push(f); };
    vv.removeEventListener = (t, f) => { listeners[t] = (listeners[t] || []).filter((x) => x !== f); };
  }
  const win = {
    innerHeight: 664,
    visualViewport: vv,
    document: { documentElement: root },
    requestAnimationFrame: (cb) => { cb(); return 1; },
    cancelAnimationFrame() {},
    addEventListener: (t, f) => { (listeners[t] ||= []).push(f); },
    removeEventListener: (t, f) => { listeners[t] = (listeners[t] || []).filter((x) => x !== f); },
  };
  return { win, root, values, fire: (t) => (listeners[t] || []).forEach((f) => f()) };
}

describe("installKeyboardCssVars", () => {
  it("publishes --kb-inset and html.kb-up when the keyboard opens, and clears them on cleanup", () => {
    const vv = { height: 664, offsetTop: 0 };
    const { win, root, values, fire } = fakeWindow(vv);
    const cleanup = installKeyboardCssVars(win);
    expect(values["--kb-inset"]).toBe("0px");
    expect(root.classList.on).toBe(false);
    vv.height = 330; fire("resize");
    expect(values["--kb-inset"]).toBe("334px");
    expect(values["--kb-h"]).toBe("330px");
    expect(root.classList.on).toBe(true);
    cleanup();
    expect(values["--kb-inset"]).toBeUndefined();
    expect(root.classList.on).toBe(false);
  });
});
