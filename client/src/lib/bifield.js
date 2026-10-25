/* Tiny helper split out of i18n.js so pages that only need biField() do not
   pull the 137 KB translation dictionary into their chunk (it is lazy-loaded
   by context.jsx after first paint). */
export function biField(obj, base, lang) {
  if (!obj) return "";
  const present=v=>typeof v==='string'?v.trim().length>0:Array.isArray(v)?v.some(present):v!=null;
  return [obj[`${base}_${lang}`],obj[`${base}_${lang==='fa'?'en':'fa'}`],obj[base]].find(present)??"";
}
