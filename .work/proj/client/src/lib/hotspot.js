/* Shared geometry for click-on-image (hotspot) questions.
   Coordinates are percentages of the IMAGE CONTENT box (object-fit: contain),
   not the padded container — so letterboxing does not shift the target. */

export function clamp(n, a = 0, b = 100) {
  const x = Number(n);
  if (!Number.isFinite(x)) return a;
  return Math.max(a, Math.min(b, x));
}

function normalizeRegion(r) {
  if (!r || typeof r !== "object") return null;
  let shape = r.shape;
  if (shape !== "circle" && shape !== "rect" && shape !== "polygon") {
    if (Array.isArray(r.points) && r.points.length >= 3) shape = "polygon";
    else if (r.w != null && r.h != null) shape = "rect";
    else shape = "circle";
  }
  if (shape === "circle") {
    return {
      shape: "circle",
      x: clamp(r.x ?? 50),
      y: clamp(r.y ?? 50),
      r: clamp(r.r ?? 8, 1, 50),
    };
  }
  if (shape === "rect") {
    let x = Number(r.x), y = Number(r.y);
    let w = Number(r.w), h = Number(r.h);
    if (!Number.isFinite(x)) x = 0;
    if (!Number.isFinite(y)) y = 0;
    if (!Number.isFinite(w) || w === 0) w = 20;
    if (!Number.isFinite(h) || h === 0) h = 16;
    if (w < 0) { x += w; w = -w; }
    if (h < 0) { y += h; h = -h; }
    x = clamp(x); y = clamp(y);
    w = clamp(w, 0.5, 100 - x);
    h = clamp(h, 0.5, 100 - y);
    return { shape: "rect", x, y, w, h };
  }
  const pts = (Array.isArray(r.points) ? r.points : [])
    .map((p) => ({ x: clamp(p?.x), y: clamp(p?.y) }))
    .slice(0, 24);
  if (pts.length < 3) return null;
  return { shape: "polygon", points: pts };
}

export function normalizeHotspot(raw) {
  const h = raw && typeof raw === "object" ? raw : {};
  const regions = [];
  for (const r of (Array.isArray(h.regions) ? h.regions : [])) {
    const n = normalizeRegion(r);
    if (n) regions.push(n);
  }
  if (!regions.length) {
    const n = normalizeRegion(h);
    if (n) regions.push(n);
  }
  if (!regions.length) regions.push({ shape: "circle", x: 50, y: 50, r: 10 });
  const first = regions[0];
  return {
    label_fa: h.label_fa || "",
    label_en: h.label_en || "",
    confirm: h.confirm !== false,
    shape: first.shape,
    x: first.x, y: first.y, r: first.r, w: first.w, h: first.h, points: first.points,
    regions,
  };
}

export function pointInRegion(pt, region) {
  if (!pt || !region) return false;
  const x = Number(pt.x), y = Number(pt.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  if (region.shape === "circle") {
    const dx = x - region.x, dy = y - region.y;
    return Math.sqrt(dx * dx + dy * dy) <= (region.r || 8);
  }
  if (region.shape === "rect") {
    return x >= region.x && x <= region.x + region.w && y >= region.y && y <= region.y + region.h;
  }
  const pts = region.points || [];
  if (pts.length < 3) return false;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
    const denom = (yj - yi) || 1e-9;
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / denom + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function pointHitsHotspot(pt, hotspot) {
  return normalizeHotspot(hotspot).regions.some((r) => pointInRegion(pt, r));
}

export function imageContentBox(img) {
  if (!img || !img.naturalWidth || !img.naturalHeight) {
    return { left: 0, top: 0, width: 0, height: 0 };
  }
  const r = img.getBoundingClientRect();
  const nw = img.naturalWidth, nh = img.naturalHeight;
  const scale = Math.min(r.width / nw, r.height / nh);
  const dw = nw * scale, dh = nh * scale;
  return {
    left: r.left + (r.width - dw) / 2,
    top: r.top + (r.height - dh) / 2,
    width: dw,
    height: dh,
  };
}

export function eventToPct(e, img) {
  const box = imageContentBox(img);
  if (box.width < 1 || box.height < 1) return null;
  const x = ((e.clientX - box.left) / box.width) * 100;
  const y = ((e.clientY - box.top) / box.height) * 100;
  if (x < -0.8 || x > 100.8 || y < -0.8 || y > 100.8) return null;
  return { x: clamp(x), y: clamp(y) };
}

export function regionPath(r) {
  if (!r || r.shape !== "polygon") return "";
  const pts = r.points || [];
  if (pts.length < 2) return "";
  return pts.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ") + " Z";
}

export function overlayBox(img, wrap) {
  if (!img || !wrap || !img.naturalWidth) return { left: 0, top: 0, width: 0, height: 0 };
  const wr = wrap.getBoundingClientRect();
  const c = imageContentBox(img);
  return {
    left: c.left - wr.left - (wrap.clientLeft || 0),
    top: c.top - wr.top - (wrap.clientTop || 0),
    width: c.width,
    height: c.height,
  };
}
