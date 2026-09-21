import { describe, it, expect } from "vitest";
import { detectExamScope, teacherExamReply, patientReply, redactDiagnosis, matchCaseImage, labImagingResult } from "../src/lib/ai-engine.js";

const c = {
  exam_fa: "مضطرب و رنگ‌پریده، صداهای قلبی طبیعی، ریه پاک، تندرنس ربع فوقانی راست",
  exam_en: "Anxious and pale, normal heart sounds, clear lungs, RUQ tenderness",
  vitals: { bp: "150/90", hr: "100" },
  diagnosis_fa: "انفارکتوس حاد میوکارد تحتانی (STEMI)", diagnosis_en: "Acute inferior STEMI",
  images: [{ url: "/uploads/demo-ecg.svg", label_fa: "نوار قلب — صعود ST", label_en: "ECG — ST elevation" }],
};

describe("VP attending: granular exam findings (round 5)", () => {
  it("a blanket full-exam request is answered with a clarifying question", async () => {
    for (const q of ["معاینه کامل", "full physical exam", "معاینه", "head to toe exam please"]) {
      const r = await patientReply({ caseData: c, userText: q, lang: "fa", prompts: {}, aiCfg: {} });
      expect(r.mode).toBe("exam");
      expect(r.clarify).toBe(true);
      expect(r.text).not.toMatch(/تندرنس|ریه پاک/);
    }
  });
  it("organ-specific requests return only that system's findings", () => {
    const abd = teacherExamReply(c, "fa", [], detectExamScope("معاینه شکم"));
    expect(abd).toMatch(/تندرنس ربع فوقانی راست/);
    expect(abd).not.toMatch(/ریه پاک|صداهای قلبی/);
    const lung = teacherExamReply(c, "en", ["lung"], detectExamScope("listen to the lungs"));
    expect(lung).toMatch(/clear lungs/);
    expect(lung).not.toMatch(/RUQ|heart sounds/);
  });
  it("vitals only when asked; unrecorded system reported as unremarkable", () => {
    const v = teacherExamReply(c, "en", [], detectExamScope("check the blood pressure"));
    expect(v).toMatch(/BP 150\/90/);
    expect(v).not.toMatch(/RUQ/);
    const neuro = teacherExamReply(c, "en", [], detectExamScope("neurological exam"));
    expect(neuro).toMatch(/unremarkable/);
  });
  it("final diagnosis is redacted from any AI output", () => {
    const out = redactDiagnosis("I think this is Acute inferior STEMI, a stemi.", c, "en");
    expect(out).not.toMatch(/stemi/i);
  });
  it("case images are delivered only when the matching study is ordered", async () => {
    expect(matchCaseImage(c, ["Chest X-ray"])).toBeNull();
    expect(matchCaseImage(c, ["Electrocardiogram (ECG)"])).toBe("/uploads/demo-ecg.svg");
    const r = await labImagingResult({ caseData: c, kind: "paraclinic", query: "ECG", lang: "en", prompts: {}, aiCfg: {} });
    expect(r.imageUrl).toBe("/uploads/demo-ecg.svg");
  });
});
