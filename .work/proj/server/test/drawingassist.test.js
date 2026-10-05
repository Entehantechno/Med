/* ================================================================
   drawingassist.test.js — mask packing, zone coverage, IoU, label
   matching and the suggested-only scoring behaviour.
   ================================================================ */
import { describe, it, expect } from "vitest";
import { packMask, unpackMask, zoneCells, assessDrawing } from "../src/lib/drawingassist.js";

const W = 10, H = 10;

function maskFromCells(cells) {
  const arr = new Uint8Array(W * H);
  for (const [x, y] of cells) arr[y * W + x] = 1;
  return { w: W, h: H, data: packMask(arr, W, H) };
}

function maskRect(x0, y0, w, h) {
  const cells = [];
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) cells.push([x, y]);
  return maskFromCells(cells);
}

describe("mask pack/unpack", () => {
  it("round-trips a bit grid", () => {
    const cells = [[0, 0], [9, 9], [3, 4]];
    const g = unpackMask(maskFromCells(cells));
    expect(g.w).toBe(W); expect(g.h).toBe(H);
    for (const [x, y] of cells) expect(g.cells[y * W + x]).toBe(1);
    expect(g.cells.reduce((a, b) => a + b, 0)).toBe(3);
  });
  it("rejects malformed/oversized payloads", () => {
    expect(unpackMask(null)).toBeNull();
    expect(unpackMask({ w: 10, h: 10 })).toBeNull();
    expect(unpackMask({ w: 999, h: 999, data: "AA" })).toBeNull();
    expect(unpackMask({ w: "x", h: 10, data: "AA" })).toBeNull();
  });
});

describe("zone rasterisation", () => {
  it("rasterises rectangles in normalized coords", () => {
    // full-canvas rect → all grid cells
    const all = zoneCells({ x: 0, y: 0, w: 100, h: 100 }, W, H);
    expect(all.length).toBe(W * H);
    // quarter in the top-left → 5×5 = 25 cells
    const q = zoneCells({ x: 0, y: 0, w: 50, h: 50 }, W, H);
    expect(q.length).toBe(25);
  });
  it("rasterises polygons via point-in-polygon", () => {
    const tri = zoneCells({ points: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 0, y: 50 }] }, W, H);
    expect(tri.length).toBeGreaterThan(5);
    expect(tri.length).toBeLessThan(25);
  });
});

describe("coverage / IoU / suggested score", () => {
  it("scores a perfect tracing at 100", () => {
    const zone = { x: 0, y: 0, w: 50, h: 50 };
    const drawing = { strokeCount: 3, mask: maskRect(0, 0, 5, 5), labels: [] };
    const r = assessDrawing(drawing, { zones: [zone], minStrokes: 1 }, { proposedPoints: 100 });
    expect(r.basis).toBe("zones");
    expect(r.coveragePct).toBe(100);
    expect(r.precisionPct).toBe(100);
    expect(r.iouPct).toBe(100);
    expect(r.suggestedPct).toBe(100);
    expect(r.notes).not.toContain("blank_canvas");
  });

  it("scores partial coverage and flags ink outside zones", () => {
    const zone = { x: 0, y: 0, w: 50, h: 50 };
    // only the left half of the zone is inked (5×~2 cells) plus ink far outside
    const drawing = { strokeCount: 2, mask: (() => {
      const cells = [];
      for (let x = 0; x < 5; x++) cells.push([x, 0]);          // 5 ink cells in zone
      for (let y = 5; y < 10; y++) for (let x = 5; x < 10; x++) cells.push([x, y]); // 25 outside
      return maskFromCells(cells);
    })() };
    const r = assessDrawing(drawing, { zones: [zone] }, { proposedPoints: 100 });
    expect(r.coveragePct).toBe(20);        // 5/25 zone cells
    expect(r.precisionPct).toBeLessThan(25);
    expect(r.notes).toContain("mostly_outside_zones");
    expect(r.suggestedPct).toBe(20);
  });

  it("matches numbered labels placed inside the right zone", () => {
    const z1 = { x: 0, y: 0, w: 20, h: 20, label: "1" };
    const z2 = { x: 80, y: 80, w: 20, h: 20, label: "2" };
    const cells = [];
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) cells.push([x, y]);
    for (let y = 8; y < 10; y++) for (let x = 8; x < 10; x++) cells.push([x, y]);
    const good = assessDrawing(
      { strokeCount: 4, mask: maskFromCells(cells), labels: [{ x: 10, y: 10, text: "1" }, { x: 90, y: 90, text: "2" }] },
      { zones: [z1, z2] }, { proposedPoints: 100 });
    expect(good.labelsTotal).toBe(2);
    expect(good.labelsMatched).toBe(2);
    expect(good.suggestedPct).toBe(100);
    const swapped = assessDrawing(
      { strokeCount: 4, mask: maskFromCells(cells), labels: [{ x: 90, y: 90, text: "1" }, { x: 10, y: 10, text: "2" }] },
      { zones: [z1, z2] }, { proposedPoints: 100 });
    expect(swapped.labelsMatched).toBe(0);
    // 70% coverage + 0% labels → 70
    expect(swapped.suggestedPct).toBe(70);
    expect(swapped.notes).toContain("missing_or_misplaced_labels");
  });

  it("falls back to an effort estimate without zones or mask", () => {
    const noZones = assessDrawing({ strokeCount: 8, mask: maskRect(0, 0, 3, 3) }, {}, { proposedPoints: 50, minStrokes: 4 });
    expect(noZones.basis).toBe("effort_only");
    expect(noZones.notes).toContain("no_zones_defined");
    expect(noZones.suggestedPct).toBe(50);     // full effort × 50 proposed
    const legacy = assessDrawing({ strokeCount: 2 }, {}, { proposedPoints: 100, minStrokes: 4 });
    expect(legacy.available).toBe(false);
    expect(legacy.suggestedPct).toBe(50);      // 2/4 effort
  });

  it("returns no assist at all when the feature is switched off", () => {
    const zone = { x: 0, y: 0, w: 50, h: 50 };
    // card-level opt-out (teacher wants plain canvas + manual review)
    expect(assessDrawing({ strokeCount: 3, mask: maskRect(0, 0, 5, 5) },
      { zones: [zone], assistEnabled: false }, { proposedPoints: 100, enabled: false })).toBeNull();
    // explicit enabled:false option (global admin flag off)
    expect(assessDrawing({ strokeCount: 3, mask: maskRect(0, 0, 5, 5) },
      { zones: [zone] }, { proposedPoints: 100, enabled: false })).toBeNull();
  });

  it("never throws on garbage input", () => {
    expect(() => assessDrawing(null, null)).not.toThrow();
    expect(() => assessDrawing({ mask: { w: 10, h: 10, data: "@@@" } }, { zones: [{ x: "a" }] })).not.toThrow();
  });
});
