import { describe, it, expect } from "vitest";
import { computeKeyboardInset, KEYBOARD_THRESHOLD_PX } from "./keyboard-viewport.js";

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
