// Mind-map zoom preference: remembered per browser. Pure helpers so the rules
// (clamp, bad stored values, storage failures) can be unit-tested.
export const ZOOM_KEY = "medlab_mindmap_zoom";
export const ZOOM_MIN = 0.6;
export const ZOOM_MAX = 1.6;

export function clampZoom(v) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number.isFinite(v) ? v : 1));
}

/* Reads the stored zoom. Missing, empty, non-numeric or non-positive values fall back to 1;
   a stored value outside the range is clamped. Storage errors (blocked or unavailable) → 1. */
export function readStoredZoom(storage) {
  try {
    const raw = storage.getItem(ZOOM_KEY);
    if (raw == null || raw === "") return 1;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? clampZoom(n) : 1;
  } catch {
    return 1;
  }
}

/* Writes the zoom. Returns false when storage is full or blocked; the zoom still works in-session. */
export function saveZoom(storage, zoom) {
  try {
    storage.setItem(ZOOM_KEY, String(zoom));
    return true;
  } catch {
    return false;
  }
}
