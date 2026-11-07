/* ================================================================
   drawingassist.js — SUGGESTED-ONLY drawing coverage assist.

   The student's canvas client rasterises the INK (anything that
   differs from the pristine canvas, so traced reference images and
   erased strokes are excluded) onto a coarse bit-mask grid and ships
   it inside answer.drawing.mask = { w, h, data }.

   When the teacher authored expected zones (rectangles or polygons in
   normalized 0..100 coordinates) on the drawing card, the server can
   score:
     • zone coverage  = ink cells inside zone / zone cells (recall)
     • ink precision  = ink cells inside any zone / all ink cells
     • IoU            = intersection / union of the two masks
     • label matching = numbered label points landing in the zone
       bearing the same number

   Everything here is an ADVISORY number for the teacher inbox: the
   score is never applied automatically and a human always approves.
   ================================================================ */

const MAX_GRID = 96;            // larger payloads are rejected as bogus

/* Feature gate for the assist:
     1. the admin's global `drawing_assist` flag must be on (it is by default);
     2. the teacher must not have switched it off for THIS drawing card
        (drawing.assistEnabled === false → plain canvas, manual review only).
   When off, neither zones nor suggested scores are returned to the inbox. */
export function drawingAssistEnabled(cardDrawing = {}) {
  try {
    if (cardDrawing && cardDrawing.assistEnabled === false) return false;
    // imported lazily through a function so the pure-math unit tests never
    // touch the database layer.
    return flagsGate();
  } catch {
    return true;   // fail open to the ordinary manual review flow (assist is advisory)
  }
}

import { isEnabled } from "./flags.js";
function flagsGate() { return isEnabled("drawing_assist"); }

export function packMask(cells, w, h) {
  const bytes = new Uint8Array(Math.ceil((w * h) / 8));
  for (let i = 0; i < w * h; i++) if (cells[i]) bytes[i >> 3] |= 1 << (7 - (i & 7));
  return Buffer.from(bytes).toString("base64");
}

export function unpackMask(mask) {
  if (!mask || !Number.isFinite(Number(mask.w)) || !Number.isFinite(Number(mask.h)) || typeof mask.data !== "string") {
    return null;
  }
  const rw = Math.round(Number(mask.w)), rh = Math.round(Number(mask.h));
  if (!Number.isFinite(rw) || !Number.isFinite(rh) || rw > MAX_GRID || rh > MAX_GRID) return null;
  const w = Math.max(1, rw), h = Math.max(1, rh);
  let raw;
  try { raw = Buffer.from(mask.data.slice(0, 4096), "base64"); } catch { return null; }
  const cells = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const b = raw[i >> 3];
    if (b == null) break;
    if (b & (1 << (7 - (i & 7)))) cells[i] = 1;
  }
  return { w, h, cells };
}

function clampPct(n) { return Math.max(0, Math.min(100, Number(n))); }
function pct(n, d) { return d ? Math.round((n / d) * 100) : 0; }

function zoneBounds(zone) {
  if (zone && Array.isArray(zone.points) && zone.points.length >= 3) {
    const xs = zone.points.map((p) => Number(p.x) || 0);
    const ys = zone.points.map((p) => Number(p.y) || 0);
    return { poly: zone.points.map((p) => ({ x: Number(p.x) || 0, y: Number(p.y) || 0 })),
      minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  }
  const x = Number(zone?.x) || 0, y = Number(zone?.y) || 0;
  const w = Math.max(0, Number(zone?.w) || 0), h = Math.max(0, Number(zone?.h) || 0);
  return { poly: null, minX: x, maxX: x + w, minY: y, maxY: y + h };
}

function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

/* Mask cells covered by an authored zone, in normalized 0..100 coords. */
export function zoneCells(zone, w, h) {
  const b = zoneBounds(zone);
  const out = [];
  const x0 = Math.max(0, Math.floor((b.minX / 100) * w));
  const x1 = Math.min(w - 1, Math.ceil((b.maxX / 100) * w));
  const y0 = Math.max(0, Math.floor((b.minY / 100) * h));
  const y1 = Math.min(h - 1, Math.ceil((b.maxY / 100) * h));
  for (let gy = y0; gy <= y1; gy++) {
    for (let gx = x0; gx <= x1; gx++) {
      const nx = ((gx + 0.5) / w) * 100, ny = ((gy + 0.5) / h) * 100;
      const hit = b.poly ? pointInPoly(nx, ny, b.poly)
        : nx >= b.minX && nx <= b.maxX && ny >= b.minY && ny <= b.maxY;
      if (hit) out.push(gy * w + gx);
    }
  }
  return out;
}

/* The advisory result. Never throws on malformed data.
   `enabled: false` short-circuits: teachers who only want the plain canvas +
   manual approve/reject get NO assist numbers at all (and no zones shown). */
export function assessDrawing(drawing, cardDrawing = {}, { proposedPoints = 100, minStrokes = 1, enabled = true } = {}) {
  drawing = drawing || {}; cardDrawing = cardDrawing || {};
  if (!enabled) return null;
  const grid = unpackMask(drawing?.mask);
  const zones = Array.isArray(cardDrawing.zones) ? cardDrawing.zones.filter((z) => z && typeof z === "object") : [];
  const strokeCount = Math.max(0, Math.min(9999, Number(drawing?.strokeCount) || 0));
  const labels = Array.isArray(drawing?.labels) ? drawing.labels : [];

  if (!grid) {
    // Older client payloads (pre-mask) only support an effort proxy.
    const effort = Math.max(0, Math.min(1, strokeCount / Math.max(1, minStrokes)));
    return {
      available: false, basis: "effort_only",
      inkPct: null, coveragePct: null, precisionPct: null, iouPct: null,
      labelsMatched: 0, labelsTotal: 0,
      zones: [],
      suggestedPct: Math.round(clampPct(effort * (Number(proposedPoints) || 100))),
      notes: ["no_mask"],
    };
  }
  const { w, h, cells } = grid;
  const inkTotal = cells.reduce((a, b) => a + b, 0);
  const inkPct = pct(inkTotal, w * h);

  if (!zones.length) {
    // No authored target: give a rough effort estimate from ink spread +
    // stroke count; explicitly flagged as non-comparable across students.
    const effort = Math.max(0, Math.min(1, strokeCount / Math.max(1, minStrokes)));
    const spread = Math.min(1, inkPct / 8);     // 8% canvas coverage ≈ full effort
    const frac = Math.round(clampPct((0.5 * effort + 0.5 * spread) * (Number(proposedPoints) || 100)));
    return {
      available: true, basis: "effort_only",
      inkPct, coveragePct: null, precisionPct: null, iouPct: null,
      labelsMatched: 0, labelsTotal: 0, zones: [],
      suggestedPct: frac, notes: ["no_zones_defined"],
    };
  }

  const zoneDetails = [];
  const target = new Uint8Array(w * h);
  let labelsTotal = 0, labelsMatched = 0;
  for (const z of zones) {
    const zc = zoneCells(z, w, h);
    let covered = 0;
    for (const i of zc) { target[i] = 1; if (cells[i]) covered++; }
    // zone expects a numbered label? count student labels landing inside it
    const expectLabel = z.label != null && z.label !== "" ? String(z.label) : null;
    let labelOk = null;
    if (expectLabel != null) {
      labelsTotal++;
      const b = zoneBounds(z);
      labelOk = labels.some((l) => {
        const x = Number(l?.x), y = Number(l?.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
        if (String(l?.text) !== expectLabel) return false;
        if (b.poly) return pointInPoly(x, y, b.poly);
        return x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY;
      });
      if (labelOk) labelsMatched++;
    }
    zoneDetails.push({ label: expectLabel, cells: zc.length, coveragePct: pct(covered, zc.length), labelOk });
  }
  let intersection = 0, union = 0, inkInside = 0, targetTotal = 0;
  for (let i = 0; i < w * h; i++) {
    const ink = !!cells[i], tgt = !!target[i];
    if (ink && tgt) { intersection++; inkInside++; }
    if (ink || tgt) union++;
    if (tgt) targetTotal++;
  }
  const coveragePct = pct(intersection, targetTotal);   // mean recall over union of zones
  const precisionPct = pct(inkInside, inkTotal);
  const iouPct = pct(intersection, union);
  // suggested weighting: 70 % shape coverage, 30 % label placement when
  // zones carry labels; pure-shape tasks use coverage alone
  const labelWeight = labelsTotal ? 0.3 : 0;
  const labelRate = labelsTotal ? labelsMatched / labelsTotal : 0;
  const frac01 = (1 - labelWeight) * (coveragePct / 100) + labelWeight * labelRate;
  const notes = [];
  if (inkTotal === 0) notes.push("blank_canvas");
  if (precisionPct < 25 && inkTotal > 0) notes.push("mostly_outside_zones");
  if (labelsTotal && labelsMatched < labelsTotal) notes.push("missing_or_misplaced_labels");
  return {
    available: true, basis: "zones",
    inkPct, coveragePct, precisionPct, iouPct,
    labelsMatched, labelsTotal,
    zones: zoneDetails,
    suggestedPct: Math.round(clampPct(frac01 * (Number(proposedPoints) || 100))),
    notes,
  };
}
