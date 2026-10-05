import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { stripCrossRefs, dedupeGolden, examSourceLabel } from "../src/lib/lessontext.js";
import { pickSchematic, BITEMPORAL, LBO_SUPINE_PRONE, ELBOW_POSTERIOR_DISLOC } from "../src/lib/schematics.js";
import { glossaryPayload } from "../src/lib/glossary.js";
import { serializeCard } from "../src/lib/cardserialize.js";
import { fillPair, pickTitle } from "../src/lib/adminbilingual.js";
import { PROVINCES, provinceLabel } from "../../client/src/data/provinces.js";
import { optionLetter } from "../../client/src/lib/optionLetter.js";

describe("self-contained answer keys", () => {
  it("strips Persian cross-question pointers", () => {
    const s = stripCrossRefs("این سؤال همان مفهوم قبلی را به صورت متنی مطرح کرده است. همی‌آنوپی بای‌تمپورال یعنی کیاسما.");
    expect(s).not.toMatch(/مفهوم قبلی/);
    expect(s).toMatch(/کیاسما/);
  });
  it("strips English see-Q references", () => {
    const s = stripCrossRefs("See the previous question for the diagram. A chiasm lesion causes bitemporal hemianopia.");
    expect(s.toLowerCase()).not.toMatch(/previous question/);
    expect(s).toMatch(/chiasm/i);
  });
  it("drops a lead that merely repeats the golden tip", () => {
    const { lead, golden } = dedupeGolden("Homonymous means behind the chiasm.", "Homonymous means behind the chiasm.");
    expect(lead).toBe("");
    expect(golden).toMatch(/Homonymous/);
  });
});

describe("exam source label", () => {
  it("builds پره انترنی شهریور ۱۳۹۸", () => {
    const label = examSourceLabel({ source_meta: { year: "1398", month: "شهریور" } }, "fa");
    expect(label).toMatch(/پره.انترنی/);
    expect(label).toMatch(/شهریور/);
    expect(label).toMatch(/۱۳۹۸/);
  });
  it("residency questions carry a residency passport", () => {
    expect(examSourceLabel({ source_meta: { kind: "past_exam_import", exam_type: "دستیاری", year: "1401", month: "اردیبهشت" } }, "fa")).toMatch(/^دستیاری اردیبهشت ۱۴۰۱$/);
    expect(examSourceLabel({ source_meta: { kind: "past_exam_import", exam_type: "دستیاری", year: "1401", month: "اردیبهشت" } }, "en")).toMatch(/^Residency · Ordibehesht 1401$/);
    expect(examSourceLabel({ source_meta: { kind: "past_exam_import", exam_type: "پره‌انترنی", year: "۱۳۹۹", month: "شهریور" } }, "en")).toBe("Pre-internship · Shahrivar 1399");
    // no date at all → still says which exam
    expect(examSourceLabel({ source_meta: { kind: "past_exam_import", exam_type: "پره‌انترنی" } }, "fa")).toBe("آزمون پره‌انترنی");
  });
  it("uses official English month names, not translations of the word", () => {
    const label = examSourceLabel({ source_meta: { year: "1402", month: "خرداد" } }, "en");
    expect(label).toMatch(/Khordad/);
    expect(label).toMatch(/Pre-internship/);
  });
});

describe("perimetry schematic", () => {
  it("attaches a figure when the stem says شکل ذیل and no image exists", () => {
    const uri = pickSchematic({
      q_fa: "در پریمتری بیماری، نقص میدان به صورت شکل ذیل مشاهده می‌شود.",
      options: [{ fa: "optic chiasm", en: "optic chiasm", correct: true }],
    });
    expect(uri).toBe(BITEMPORAL);
    expect(uri.startsWith("data:image/svg+xml")).toBe(true);
  });
  it("stands in for the missing 1403 LBO and open-elbow booklet films", () => {
    const abd = pickSchematic({
      q_fa: "گرافی شکم در حالت Supain و Prone. با توجه به تصویر ذیل کدام تشخیص محتمل تر است؟",
    });
    expect(abd).toBe(LBO_SUPINE_PRONE);
    const arm = pickSchematic({
      q_fa: "افتادن از دوچرخه زخم ساعد. در رادیوگرافی ساده تصویر زیر را میبینید.",
    });
    expect(arm).toBe(ELBOW_POSTERIOR_DISLOC);
  });
});

describe("glossary + provinces", () => {
  it("ships bilingual glossary entries", () => {
    const g = glossaryPayload("fa");
    expect(g.some((x) => x.keys.some((k) => /کیاسما|chiasm/i.test(k)))).toBe(true);
    expect(g[0].def.length).toBeGreaterThan(10);
  });
  it("never translates Markazi as Central", () => {
    const m = PROVINCES.find((p) => p.fa === "مرکزی");
    expect(m.en).toBe("Markazi");
    expect(provinceLabel("مرکزی", "en")).toBe("Markazi");
  });
});

describe("admin bilingual pair + titles", () => {
  it("fills the empty language from the other", () => {
    expect(fillPair("دمانس ۱", "")).toEqual({ fa: "دمانس ۱", en: "دمانس ۱" });
    expect(fillPair("", "Dementia 1")).toEqual({ fa: "Dementia 1", en: "Dementia 1" });
    expect(fillPair("دمانس ۱", "Dementia 1")).toEqual({ fa: "دمانس ۱", en: "Dementia 1" });
  });
  it("shows EN title falling back to FA so a FA-only edit is still visible in EN", () => {
    expect(pickTitle("en", "درس ۲", "")).toBe("درس ۲");
    expect(pickTitle("fa", "", "Lesson 2")).toBe("Lesson 2");
  });
});

describe("booklet option letters follow UI language", () => {
  it("uses الف ب ج د in Persian and A B C D in English", () => {
    expect(["الف", "ب", "ج", "د"]).toEqual([0, 1, 2, 3].map((i) => optionLetter(i, "fa")));
    expect(["A", "B", "C", "D"]).toEqual([0, 1, 2, 3].map((i) => optionLetter(i, "en")));
    expect(optionLetter(0, "fa")).not.toBe("A");
  });
});

describe("mobile learner shell markers", () => {
  it("keeps immersive lesson + short tab labels + option letters", () => {
    const app = readFileSync(new URL("../../client/src/pages/learn/LearnApp.jsx", import.meta.url), "utf8");
    const css = readFileSync(new URL("../../client/src/mobile-learn.css", import.meta.url), "utf8");
    const qt = readFileSync(new URL("../../client/src/pages/learn/QuestionTypes.jsx", import.meta.url), "utf8");
    expect(app).toMatch(/is-immersive-lesson/);
    expect(app).toMatch(/navTabHome/);
    expect(app).toMatch(/tab-badge/);
    expect(app).toMatch(/kb-open/);
    expect(app).toMatch(/onHomeStats/);
    expect(app).toMatch(/if \(tab === "home"\) return/);
    expect(css).toMatch(/home-quick/);
    expect(qt).toMatch(/optionLetter/);
    expect(qt).not.toMatch(/fromCharCode\(65/);
  });
});

describe("serializeCard lesson hygiene", () => {
  it("drops micro.options when each choice already has a why", () => {
    const card = serializeCard({
      id: 1,
      difficulty: "medium",
      data_json: JSON.stringify({
        type: "mcq",
        q_fa: "محل ضایعه؟",
        q_en: "Where is the lesion?",
        options: [
          { fa: "کیاسما", en: "chiasm", correct: true, why_fa: "بای‌تمپورال یعنی کیاسما.", why_en: "Bitemporal means chiasm." },
          { fa: "تراکت", en: "tract", correct: false, why_fa: "تراکت همی‌آنوپی هومونیموس می‌دهد.", why_en: "Tract is homonymous." },
        ],
        micro: {
          lead_fa: "میدان بینایی",
          golden_fa: "کیاسما = بای‌تمپورال",
          options_fa: ["کیاسما درست است", "تراکت نادرست است"],
          options_en: ["chiasm is right", "tract is wrong"],
        },
      }),
    }, "fa");
    expect(card.options[0].why).toMatch(/کیاسما/);
    expect(card.micro.options).toEqual([]);
  });
});
