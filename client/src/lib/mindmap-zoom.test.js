import { describe, it, expect } from "vitest";
import { readStoredZoom, saveZoom, clampZoom, ZOOM_KEY } from "./mindmap-zoom.js";

function memStore(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), _m: m };
}

describe("mind-map zoom persistence", () => {
  it("defaults to 100% when nothing is stored", () => {
    expect(readStoredZoom(memStore())).toBe(1);
  });
  it("restores a saved zoom", () => {
    expect(readStoredZoom(memStore({ [ZOOM_KEY]: "1.15" }))).toBe(1.15);
  });
  it("ignores bad stored values", () => {
    for (const bad of ["", "abc", "0", "-2", "NaN"]) expect(readStoredZoom(memStore({ [ZOOM_KEY]: bad }))).toBe(1);
  });
  it("clamps out-of-range stored values", () => {
    expect(readStoredZoom(memStore({ [ZOOM_KEY]: "9" }))).toBe(1.6);
    expect(readStoredZoom(memStore({ [ZOOM_KEY]: "0.2" }))).toBe(0.6);
  });
  it("survives a blocked storage (throws) with 100%", () => {
    const blocked = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); } };
    expect(readStoredZoom(blocked)).toBe(1);
    expect(saveZoom(blocked, 1.3)).toBe(false);
  });
  it("saves and reads back the same value (round trip)", () => {
    const s = memStore();
    expect(saveZoom(s, 1.45)).toBe(true);
    expect(readStoredZoom(s)).toBe(1.45);
  });
  it("clampZoom handles non-finite input", () => {
    expect(clampZoom(NaN)).toBe(1);
    expect(clampZoom(Infinity)).toBe(1);
  });
});
