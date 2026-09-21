/* schematics.js — small inline SVG figures for questions that say
   «شکل ذیل» / "the figure shown" but shipped without an image.
   Pure SVG data-URIs: no extra HTTP, no CDN, no AI. */

function svgUri(inner, w = 560, h = 280) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img">${inner}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function eyePair({ leftFill, rightFill, captionFa, captionEn, caption }) {
  const L = leftFill;  // [nasal, temporal] of LEFT eye (drawn on the right in standard perimetry? we draw anatomical: left eye on left)
  const R = rightFill;
  const eye = (cx, nasalDark, tempDark, label) => {
    const n = nasalDark ? "#1e2b3d" : "#f4f7fb";
    const t = tempDark ? "#1e2b3d" : "#f4f7fb";
    // temporal is outer, nasal is inner (toward nose / center)
    const isLeft = cx < 280;
    const tempX = isLeft ? cx - 70 : cx;
    const nasX = isLeft ? cx : cx - 70;
    return `
      <rect x="${tempX}" y="70" width="70" height="120" fill="${t}" stroke="#1e2b3d" stroke-width="2"/>
      <rect x="${nasX}" y="70" width="70" height="120" fill="${n}" stroke="#1e2b3d" stroke-width="2"/>
      <ellipse cx="${cx}" cy="130" rx="72" ry="64" fill="none" stroke="#1e2b3d" stroke-width="3"/>
      <text x="${cx}" y="220" text-anchor="middle" font-size="14" font-family="sans-serif" fill="#647184">${label}</text>
      <text x="${isLeft ? cx - 36 : cx + 36}" y="64" text-anchor="middle" font-size="11" font-family="sans-serif" fill="#647184">T</text>
      <text x="${isLeft ? cx + 36 : cx - 36}" y="64" text-anchor="middle" font-size="11" font-family="sans-serif" fill="#647184">N</text>
    `;
  };
  return svgUri(`
    <rect width="560" height="280" fill="#ffffff"/>
    <text x="280" y="28" text-anchor="middle" font-size="15" font-family="sans-serif" font-weight="700" fill="#1e2b3d">${caption || captionFa}</text>
    ${eye(150, L[0], L[1], "OS (L)")}
    ${eye(410, R[0], R[1], "OD (R)")}
    <text x="280" y="258" text-anchor="middle" font-size="11" font-family="sans-serif" fill="#8a96a8">T = temporal · N = nasal · shaded = defect</text>
  `);
}

/** Bitemporal hemianopia — both temporal fields dark (chiasm). */
export const BITEMPORAL = eyePair({
  leftFill: [false, true],
  rightFill: [false, true],
  captionFa: "همی‌آنوپی بای‌تمپورال",
  caption: "Bitemporal hemianopia",
});

/** Right homonymous hemianopia — both right halves (left tract / radiation / occipital). */
export const HOMONYMOUS_RIGHT = eyePair({
  leftFill: [true, false],
  rightFill: [false, true],
  caption: "Right homonymous hemianopia",
});

/** Left monocular (left optic nerve) — whole left eye dark. */
export const LEFT_OPTIC_NERVE = eyePair({
  leftFill: [true, true],
  rightFill: [false, false],
  caption: "Left monocular field loss",
});

/** Teaching stand-in: supine + prone abdomen with LBO (haustra, cutoff, empty rectum). */
export const LBO_SUPINE_PRONE = svgUri(`
  <rect width="560" height="280" fill="#ffffff"/>
  <title>Teaching schematic: large-bowel obstruction on supine and prone films</title>
  <text x="280" y="22" text-anchor="middle" font-size="14" font-family="sans-serif" font-weight="700" fill="#1e2b3d">Supine + prone abdomen — LBO (teaching)</text>
  <rect x="18" y="36" width="250" height="200" rx="8" fill="#f4f7fb" stroke="#1e2b3d" stroke-width="2"/>
  <text x="143" y="56" text-anchor="middle" font-size="12" font-family="sans-serif" fill="#647184">SUPINE</text>
  <ellipse cx="70" cy="120" rx="28" ry="48" fill="none" stroke="#1e2b3d" stroke-width="2"/>
  <path d="M48 100 h44 M46 120 h48 M50 140 h40" stroke="#8a96a8" stroke-width="1.5"/>
  <ellipse cx="200" cy="130" rx="30" ry="52" fill="none" stroke="#1e2b3d" stroke-width="2"/>
  <path d="M176 110 h48 M174 130 h52 M178 150 h44" stroke="#8a96a8" stroke-width="1.5"/>
  <text x="143" y="220" text-anchor="middle" font-size="11" font-family="sans-serif" fill="#647184">peripheral haustra · cutoff</text>
  <rect x="292" y="36" width="250" height="200" rx="8" fill="#f4f7fb" stroke="#1e2b3d" stroke-width="2"/>
  <text x="417" y="56" text-anchor="middle" font-size="12" font-family="sans-serif" fill="#647184">PRONE</text>
  <ellipse cx="360" cy="125" rx="26" ry="44" fill="none" stroke="#1e2b3d" stroke-width="2"/>
  <ellipse cx="470" cy="125" rx="26" ry="44" fill="none" stroke="#1e2b3d" stroke-width="2"/>
  <rect x="392" y="178" width="50" height="28" rx="4" fill="#ffffff" stroke="#c0392b" stroke-width="2" stroke-dasharray="4 3"/>
  <text x="417" y="197" text-anchor="middle" font-size="10" font-family="sans-serif" fill="#c0392b">rectum</text>
  <text x="417" y="220" text-anchor="middle" font-size="11" font-family="sans-serif" fill="#647184">no rectal gas = complete LBO</text>
  <text x="280" y="262" text-anchor="middle" font-size="11" font-family="sans-serif" fill="#8a96a8">Not the ministry film — teaching gas map</text>
`, 560, 280);

/** Teaching stand-in: lateral elbow with posterior dislocation. */
export const ELBOW_POSTERIOR_DISLOC = svgUri(`
  <rect width="560" height="280" fill="#ffffff"/>
  <title>Teaching schematic: posterior elbow dislocation</title>
  <text x="280" y="22" text-anchor="middle" font-size="14" font-family="sans-serif" font-weight="700" fill="#1e2b3d">Lateral elbow — posterior dislocation (teaching)</text>
  <path d="M80 70 L210 90 L210 200" fill="none" stroke="#1e2b3d" stroke-width="10" stroke-linecap="round"/>
  <text x="88" y="64" font-size="12" font-family="sans-serif" fill="#647184">humerus</text>
  <path d="M320 150 L500 168" fill="none" stroke="#1e2b3d" stroke-width="9" stroke-linecap="round"/>
  <path d="M318 168 Q300 210 340 230" fill="none" stroke="#1e2b3d" stroke-width="8" stroke-linecap="round"/>
  <text x="430" y="158" font-size="12" font-family="sans-serif" fill="#647184">ulna / olecranon</text>
  <circle cx="318" cy="158" r="8" fill="#c0392b"/>
  <path d="M230 120 L300 150" stroke="#c0392b" stroke-width="2"/>
  <text x="232" y="112" font-size="12" font-family="sans-serif" fill="#c0392b">olecranon sits behind</text>
  <text x="280" y="262" text-anchor="middle" font-size="11" font-family="sans-serif" fill="#8a96a8">Usually closed reduction · 7 cm wound = Gustilo II</text>
`, 560, 280);

export function pickSchematic(d = {}, lang = "fa") {
  const q = `${d.q_fa || ""} ${d.q_en || ""} ${d.questionText_fa || ""} ${d.questionText_en || ""}`;
  if (d.image || d.imageUrl || d.media) return null;

  if (/تصویر\s*ذیل|تصویر ذیل/.test(q) && /Supain|Prone|prone|سوپاین|خوابیده/i.test(q)) {
    return LBO_SUPINE_PRONE;
  }
  if (/تصویر\s*زیر|رادیوگرافی ساده تصویر/.test(q) && /دوچرخه|ساعد|گاستیلو/i.test(q)) {
    return ELBOW_POSTERIOR_DISLOC;
  }

  const needs = /شکل\s*(ذیل|مقابل|زیر)|پریمتری|perimetr|visual field defect illustrated|the perimetry shown/i.test(q);
  if (!needs) return null;

  const opts = Array.isArray(d.options) ? d.options : [];
  const correct = opts.find((o) => o.correct) || {};
  const ans = `${correct.fa || ""} ${correct.en || ""}`.toLowerCase();

  if (/chiasm|کیاسما/.test(ans)) return BITEMPORAL;
  if (/optic nerve|عصب\s*اپتیک|optic nerve/.test(ans) && !/tract|radiation/.test(ans)) return LEFT_OPTIC_NERVE;
  if (/tract|radiation|occipital|لوب\s*اکسیپیتال/.test(ans)) return HOMONYMOUS_RIGHT;
  // Default for the classic «شکل ذیل» chiasm item (correct_index 2 = chiasm).
  if (/پریمتری|perimetr/.test(q)) return BITEMPORAL;
  return null;
}
