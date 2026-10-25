import { describe, it, expect } from "vitest";
import { normalizeText, parseQuery, searchPool, highlightRanges, suggest, normDigits } from "../src/lib/textsearch.js";

const mk = (id, q, facets = {}) => ({ id, q, hay: normalizeText(q), facets });
const pool = [
  mk(1, "درمان حملهٔ حاد آسم کدام است؟", { year: "1402", subject: "داخلی" }),
  mk(2, "کودک ۵ ساله با آسم و تب", { year: "1401", subject: "کودکان" }),
  mk(3, "فشار خون بالا در بارداری", { year: "1402", subject: "زنان" }),
  mk(4, "Asthma treatment in adults", { year: "1400", subject: "داخلی" }),
];

describe("textsearch", () => {
  it("normalises Persian/Arabic variants, digits, ZWNJ and diacritics", () => {
    expect(normalizeText("كتاب")).toBe(normalizeText("کتاب"));
    expect(normalizeText("علي")).toBe(normalizeText("علی"));
    expect(normalizeText("۱۴۰۲")).toBe("1402");
    expect(normalizeText("حملهٔ")).toBe(normalizeText("حمله"));
    expect(normalizeText("می\u200cشود")).toBe(normalizeText("می شود"));
    expect(normDigits("۴۰۱۲۳۴۵۶")).toBe("40123456");
    expect(normDigits("٤٠١٢٣٤٥٦")).toBe("40123456");
  });
  it("parses terms, phrases, excludes, field filters and #id", () => {
    const pq = parseQuery('آسم "حاد" -کودک سال:1402 #12');
    expect(pq.terms).toContain("اسم");
    expect(pq.phrases).toEqual(["حاد"]);
    expect(pq.excludes).toEqual(["کودک"]);
    expect(pq.fields.year).toEqual(["1402"]);
    expect(pq.id).toBe(12);
  });
  it("ANDs terms, honours excludes and field filters", () => {
    expect(searchPool(pool, "آسم").hits.map((h) => h.id)).toEqual([1, 2]);
    expect(searchPool(pool, "آسم -کودک").hits.map((h) => h.id)).toEqual([1]);
    expect(searchPool(pool, "year:1402").hits.map((h) => h.id).sort()).toEqual([1, 3]);
    expect(searchPool(pool, '"فشار خون"').hits.map((h) => h.id)).toEqual([3]);
    expect(searchPool(pool, "#4").hits.map((h) => h.id)).toEqual([4]);
    expect(searchPool(pool, "asthma").hits.map((h) => h.id)).toEqual([4]);
  });
  it("returns the whole pool for an empty query", () => {
    expect(searchPool(pool, "   ").hits).toHaveLength(4);
  });
  it("produces highlight ranges in UTF-16 offsets of the original string", () => {
    const orig = "کودک ۵ ساله با آسم و تب";
    const r = highlightRanges(orig, parseQuery("آسم"));
    expect(r.length).toBe(1);
    expect(orig.slice(r[0][0], r[0][1])).toBe("آسم");
  });
  it("suggests prefix matches before substring matches", () => {
    const s = suggest("قل", [["قلب", "عضله قلب", "کلیه"]]);
    expect(s[0]).toBe("قلب");
    expect(s).toContain("عضله قلب");
    expect(s).not.toContain("کلیه");
  });
});
