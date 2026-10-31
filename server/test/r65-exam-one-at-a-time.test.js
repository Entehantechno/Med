// Round 65: the supervising instructor reports ONE examination per reply.
// Several systems named in one request ("heart and lungs", "vitals and heart", a bare
// "سمع") get a "which one first?" question and no findings. The model never receives
// findings for systems the student did not ask for. Also covers the keyword false
// positives found in the R65 bug hunt (گوش = listen, heart rate, احساس).
import { describe, it, expect } from "vitest";
import {
  patientReply, detectExamScope, detectExamRequest, detectAuscultation, teacherExamReply,
  examModelChart, namesOtherSystem, requestedExamKeys, scopedExamFindings,
} from "../src/lib/ai-engine.js";

const CASE = {
  exam_fa: "مضطرب و رنگ‌پریده، صداهای قلبی طبیعی، ریه پاک، تندرنس ربع فوقانی راست",
  exam_en: "Anxious and pale, normal heart sounds, clear lungs, RUQ tenderness",
  vitals: { bp: "150/90", hr: "100" },
  lungSound: "/uploads/lung.mp3",
  heartSound: "/uploads/heart.mp3",
  diagnosis_fa: "انفارکتوس حاد میوکارد تحتانی (STEMI)",
  diagnosis_en: "Acute inferior STEMI",
};

const reply = (userText, lang = /[\u0600-\u06FF]/.test(userText) ? "fa" : "en") =>
  patientReply({ caseData: CASE, userText, history: [], lang, prompts: {}, aiCfg: {} });

describe("R65 one examination per reply: several systems ask which one first", () => {
  const MULTI = [
    "دکتر ریه‌هایش را گوش کنید و قلبش را هم گوش بدهید",
    "دکتر ریه و قلبش را گوش کنید",
    "listen to the heart and lungs",
    "vitals and heart",
    "check the blood pressure and the abdomen",
    "معاینه شکم و قلب",
  ];
  it.each(MULTI)("asks, reports nothing: %s", async (text) => {
    const r = await reply(text);
    expect(r.mode).toBe("exam");
    expect(r.clarify).toBe(true);
    expect(r.text).toMatch(/one (examination|at a time)|یک معاینه|هر بار/i);
    expect(r.text).not.toMatch(/ریه پاک|clear lungs|صداهای قلبی طبیعی|normal heart|RUQ|تندرنس|BP 150|Vital signs:|علائم حیاتی:/i);
    expect(r.audio).toBeUndefined();
  });

  it("the question lists only the examinations the student named", async () => {
    const r = await reply("listen to the heart and lungs");
    expect(r.text).toMatch(/lung/i);
    expect(r.text).toMatch(/cardiovascular/i);
    expect(r.text).not.toMatch(/abdomen|neurolog|skin|head/i);
  });

  it("after the question, answering with one system reports only that system", async () => {
    const first = await reply("دکتر ریه و قلبش را گوش کنید");
    const history = [
      { role: "student", text: "دکتر ریه و قلبش را گوش کنید" },
      { role: "patient", mode: "exam", text: first.text },
    ];
    const r = await patientReply({ caseData: CASE, userText: "شکم", history, lang: "fa", prompts: {}, aiCfg: {} });
    expect(r.clarify).toBeFalsy();
    expect(r.mode).toBe("exam");
    expect(r.text).toMatch(/تندرنس ربع فوقانی راست/);
    expect(r.text).not.toMatch(/ریه پاک|صداهای قلبی/);
  });
});

describe("R65 auscultation: one organ at a time, never both recordings", () => {
  it("a bare auscultation request asks lungs or heart and sends no audio", async () => {
    for (const q of ["سمع", "صدای سمع", "auscultation please"]) {
      const r = await reply(q);
      expect(r.clarify).toBe(true);
      expect(r.audio).toBeUndefined();
      expect(r.text).not.toMatch(/Vital signs|علائم حیاتی:|BP 150/);
    }
  });
  it("auscultating both lungs and heart asks which first and plays neither", async () => {
    const r = await reply("auscultate the heart and lungs");
    expect(r.clarify).toBe(true);
    expect(r.audio).toBeUndefined();
  });
  it("a single organ still plays its recording", async () => {
    const lung = await reply("سمع ریه");
    expect(lung.audio.map((a) => a.kind)).toEqual(["lung"]);
    const heart = await reply("Auscultate the heart please");
    expect(heart.audio.map((a) => a.kind)).toEqual(["heart"]);
  });
  it("detectAuscultation still reports the organs (used by the grader and the UI)", () => {
    expect(detectAuscultation("سمع ریه و قلب").organs.sort()).toEqual(["heart", "lung"]);
  });
});

describe("R65 vitals and single-system requests", () => {
  it("heart rate is a vital-sign request, not the heart system", () => {
    expect(detectExamScope("heart rate please").systems).toEqual(["vitals"]);
    expect(detectExamScope("check the heart rate").systems).toEqual(["vitals"]);
  });
  it("heart rate please reports vitals only", async () => {
    const r = await reply("heart rate please");
    expect(r.clarify).toBeFalsy();
    expect(r.text).toMatch(/BP 150\/90/);
    expect(r.text).not.toMatch(/heart sounds|صداهای قلبی|RUQ/);
  });
  it("bare term lists are exam requests (vitals and heart; علائم حیاتی و قلب)", () => {
    expect(detectExamRequest("vitals and heart")).toBe(true);
    expect(detectExamRequest("علائم حیاتی و قلب")).toBe(true);
    expect(detectExamRequest("heart rate please")).toBe(true);
  });
  it("patient questions stay with the patient", () => {
    expect(detectExamRequest("do you have chest pain?")).toBe(false);
    expect(detectExamRequest("آیا تب دارید؟")).toBe(false);
    expect(detectExamRequest("Do you have high blood pressure?")).toBe(false);
  });
});

describe("R65 keyword false positives", () => {
  it("گوش as a verb (listen) does not pull in head & neck", () => {
    expect(detectExamScope("دکتر ریه‌هایش را گوش کنید").systems).toEqual(["chest"]);
    expect(detectExamScope("دکتر قلبش رو گوش بدید؟").systems).toEqual(["heart"]);
    expect(detectExamScope("listen to the chest and ears").systems.sort()).toEqual(["chest", "heent"].sort());
  });
  it("ears are still a head & neck request", () => {
    expect(detectExamScope("دکتر گوش ها را معاینه کنید").systems).toEqual(["heent"]);
  });
  it("احساس (feeling) is not the neurological sensation test", () => {
    expect(detectExamScope("احساس درد در پا را بپرس").systems).not.toContain("neuro");
    expect(detectExamScope("دکتر حس پاها را چک کنید").systems).toContain("neuro");
  });
});

describe("R65 model path receives only the requested part", () => {
  const exam = CASE.exam_fa;
  it("chart for a chest request has no abdomen or heart findings and no vitals", () => {
    const chart = examModelChart(CASE, "fa", ["chest"], [{ kind: "lung" }]);
    expect(chart.exam_findings).toMatch(/ریه پاک/);
    expect(chart.exam_findings).not.toMatch(/تندرنس|صداهای قلبی/);
    expect(chart.vitals).toBeNull();
    expect(chart.available_recordings).toEqual(["lung"]);
  });
  it("chart for vitals alone has no exam text", () => {
    const chart = examModelChart(CASE, "fa", ["vitals"], []);
    expect(chart.exam_findings).toBeNull();
    expect(chart.vitals).toEqual(CASE.vitals);
  });
  it("the full exam text is never placed in the chart for one request", () => {
    const chart = examModelChart(CASE, "fa", ["abdomen"], []);
    expect(JSON.stringify(chart)).not.toContain(exam);
    expect(chart.exam_findings).toMatch(/تندرنس/);
  });
  it("requestedExamKeys merges system and auscultation organ without duplicates", () => {
    expect(requestedExamKeys({ systems: ["chest"] }, ["lung"])).toEqual(["chest"]);
    expect(requestedExamKeys({ systems: ["vitals"] }, ["heart"]).sort()).toEqual(["heart", "vitals"]);
  });
});

describe("R65 model output guard", () => {
  it("a reply that volunteers an unrequested system is flagged", () => {
    expect(namesOtherSystem("Lungs are clear and the heart sounds are normal.", ["chest"])).toBe(true);
    expect(namesOtherSystem("The lungs are clear, no crackles.", ["chest"])).toBe(false);
    expect(namesOtherSystem("The lungs are clear, with BP 120/80.", ["chest"])).toBe(false);
  });
});

describe("R65 wording", () => {
  it("English vital signs reply has no doubled space", () => {
    const en = teacherExamReply(CASE, "en", [], detectExamScope("check the blood pressure"));
    expect(en).not.toMatch(/  /);
    expect(en).toMatch(/Vital signs: BP 150\/90/);
  });
  it("scoped findings still split on sentences for the chest", () => {
    expect(scopedExamFindings("ریه: صداهای وزیکولار. شکم نرم.", ["chest"]).text).not.toMatch(/شکم/);
  });
});
