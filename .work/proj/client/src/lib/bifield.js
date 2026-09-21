/* Tiny helper split out of i18n.js so pages that only need biField() do not
   pull the 137 KB translation dictionary into their chunk (it is lazy-loaded
   by context.jsx after first paint). */
export function biField(obj, base, lang) {
  if (!obj) return "";
  return obj[`${base}_${lang}`] ?? obj[`${base}_en`] ?? obj[base] ?? "";
}
