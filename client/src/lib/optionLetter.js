/* Official Iranian booklets label choices الف ب ج د.
   English booklets (and international banks) use A B C D.
   Never mix the two — the letter must follow the UI language. */

const FA = ["الف", "ب", "ج", "د", "ه", "و", "ز", "ح"];
const EN = ["A", "B", "C", "D", "E", "F", "G", "H"];

export function optionLetter(index, lang) {
  const i = Number(index);
  if (!Number.isFinite(i) || i < 0) return "";
  const row = lang === "en" ? EN : FA;
  return row[i] || (lang === "en" ? String.fromCharCode(65 + i) : String(i + 1));
}

export function optionLetterAria(index, lang) {
  const L = optionLetter(index, lang);
  return lang === "en" ? `Option ${L}` : `گزینه ${L}`;
}
