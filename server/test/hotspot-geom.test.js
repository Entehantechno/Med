import { describe, it, expect } from "vitest";
import {
  normalizeHotspot, pointHitsHotspot, pointInRegion,
  imageContentBox, eventToPct, overlayBox,
} from "../../client/src/lib/hotspot.js";

describe("hotspot geometry", () => {
  it("treats a legacy {x,y,r} payload as a circle", () => {
    const h = normalizeHotspot({ x: 40, y: 50, r: 10, label_fa: "گلومرول" });
    expect(h.regions[0].shape).toBe("circle");
    expect(h.regions[0].x).toBe(40);
    expect(pointHitsHotspot({ x: 40, y: 50 }, h)).toBe(true);
    expect(pointHitsHotspot({ x: 52, y: 50 }, h)).toBe(false);
  });

  it("hits a rectangle and misses outside it", () => {
    const h = normalizeHotspot({ shape: "rect", x: 20, y: 30, w: 15, h: 10 });
    expect(pointHitsHotspot({ x: 25, y: 35 }, h)).toBe(true);
    expect(pointHitsHotspot({ x: 10, y: 35 }, h)).toBe(false);
  });

  it("hits a rectangle that starts at 0,0", () => {
    const h = normalizeHotspot({ shape: "rect", x: 0, y: 0, w: 20, h: 10 });
    expect(h.regions[0].x).toBe(0);
    expect(pointHitsHotspot({ x: 1, y: 1 }, h)).toBe(true);
    expect(pointHitsHotspot({ x: 25, y: 1 }, h)).toBe(false);
  });

  it("normalizes a negative-width rect into a positive box", () => {
    const h = normalizeHotspot({ shape: "rect", x: 40, y: 40, w: -20, h: 10 });
    expect(h.regions[0].w).toBeGreaterThan(0);
    expect(pointHitsHotspot({ x: 30, y: 45 }, h)).toBe(true);
  });

  it("hits a concave-enough polygon via ray-cast", () => {
    const region = { shape: "polygon", points: [{ x: 10, y: 10 }, { x: 40, y: 10 }, { x: 40, y: 40 }, { x: 10, y: 40 }] };
    expect(pointInRegion({ x: 25, y: 25 }, region)).toBe(true);
    expect(pointInRegion({ x: 50, y: 25 }, region)).toBe(false);
    expect(pointInRegion({ x: 10, y: 10 }, region)).toBe(true);
  });

  it("any extra accepted region counts as a hit", () => {
    const h = normalizeHotspot({
      regions: [
        { shape: "rect", x: 5, y: 5, w: 10, h: 10 },
        { shape: "circle", x: 80, y: 80, r: 6 },
      ],
    });
    expect(pointHitsHotspot({ x: 8, y: 8 }, h)).toBe(true);
    expect(pointHitsHotspot({ x: 80, y: 80 }, h)).toBe(true);
    expect(pointHitsHotspot({ x: 50, y: 50 }, h)).toBe(false);
  });

  it("empty payload still yields a default circle (does not crash)", () => {
    const h = normalizeHotspot(null);
    expect(h.regions[0].shape).toBe("circle");
    expect(h.confirm).toBe(true);
  });
});

describe("image content box mapping", () => {
  function fakeImg({ nw, nh, left, top, width, height }) {
    return {
      naturalWidth: nw,
      naturalHeight: nh,
      getBoundingClientRect: () => ({ left, top, width, height, right: left + width, bottom: top + height }),
    };
  }

  it("returns a zero box when the image has not loaded (naturalWidth 0)", () => {
    const box = imageContentBox(fakeImg({ nw: 0, nh: 0, left: 10, top: 10, width: 400, height: 300 }));
    expect(box).toEqual({ left: 0, top: 0, width: 0, height: 0 });
    expect(eventToPct({ clientX: 50, clientY: 50 }, fakeImg({ nw: 0, nh: 0, left: 0, top: 0, width: 100, height: 100 }))).toBeNull();
  });

  it("maps clicks to the letterboxed content, not the padded element", () => {
    const img = fakeImg({ nw: 800, nh: 400, left: 0, top: 0, width: 400, height: 400 });
    const box = imageContentBox(img);
    expect(box.left).toBe(0);
    expect(box.top).toBe(100);
    expect(box.width).toBe(400);
    expect(box.height).toBe(200);
    const mid = eventToPct({ clientX: 200, clientY: 200 }, img);
    expect(mid.x).toBe(50);
    expect(mid.y).toBe(50);
    expect(eventToPct({ clientX: 200, clientY: 20 }, img)).toBeNull();
  });

  it("subtracts the wrap border so the overlay sits on the padding box", () => {
    const img = fakeImg({ nw: 100, nh: 100, left: 11, top: 11, width: 200, height: 200 });
    const wrap = {
      clientLeft: 1,
      clientTop: 1,
      getBoundingClientRect: () => ({ left: 10, top: 10, width: 202, height: 202 }),
    };
    const box = overlayBox(img, wrap);
    expect(box.left).toBe(0);
    expect(box.top).toBe(0);
    expect(box.width).toBe(200);
    expect(box.height).toBe(200);
    expect(overlayBox({ naturalWidth: 0 }, wrap)).toEqual({ left: 0, top: 0, width: 0, height: 0 });
  });
});
