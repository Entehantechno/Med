// Round 64: staff-directed exam requests are recognised, and the patient never refuses
// an exam. The supervising instructor answers from the recorded findings instead.
import { describe, it, expect } from "vitest";
import { detectExamRequest, deflectsExamRequest, patientReply, teacherExamReply } from "../src/lib/ai-engine.js";

// Requests a student makes to a teacher, nurse, or other clinician at the station.
const STAFF_REQUESTS = [
  "دکتر لطفاً بیمار را معاینه کنید",
  "استاد می‌شه بیمار را معاینه کنید؟",
  "دکتر لطفا معاینه فیزیکی انجام بدید",
  "پرستار لطفاً فشار خون بیمار را بگیرید",
  "خانم پرستار نبضش را بگیرید",
  "آقای دکتر ممکن است شکمش را لمس کنید؟",
  "استاد می‌خواهم معاینه کنم",
  "دکتر لطفاً ریه‌هایش را گوش کنید",
  "دکتر صدای قلبش را گوش کنید",
  "می‌شه دکتر قلبش رو گوش بدید؟",
  "دکتر میشه علائم حیاتی رو بگیرید",
  "استاد دما و تنفسش را اندازه بگیرید",
  "پرستار لطفا وضعیت عمومی بیمار را بررسی کنید",
  "دکتر، معاینه بالینی بیمار چه یافته‌هایی دارد؟",
  "بیمار را معاینه کن",
  "ممکن است لطفاً شکم بیمار را معاینه کنید",
  "Doctor, please examine the patient",
  "Nurse, can you check his blood pressure?",
  "Could you examine his abdomen?",
  "Would you mind listening to his chest?",
  "Let me listen to his heart",
  "I want to examine the patient",
  "I would like to do a full physical exam",
  "Please take his vitals",
  "Can you palpate the abdomen?",
  "Doctor, would you check his pulse and temperature?",
  "Nurse, please measure his oxygen saturation",
  "Can you perform a neurological exam?",
  "Please auscultate the lungs",
  "Professor, could you do the physical exam for me?",
  "Sister, check the vitals please",
  "Doctor, can you look at his abdomen and tell me what you find",
  "Please inspect the skin",
  "Doctor, do a head to toe exam",
];

// Patient-voiced questions about history or symptoms: these must NOT be treated as exam requests.
const PATIENT_QUESTIONS = [
  "آیا قبلاً معاینه شده‌اید؟",
  "Have you been examined before?",
  "دکتر درد شما از کی شروع شد؟",
  "آیا فشار خون بالا دارید؟",
  "Do you have high blood pressure?",
  "What brings you in today?",
  "How long have you had the pain?",
  "آیا تب دارید؟",
  "Do you take any medications?",
  "کی به دکتر مراجعه کردید؟",
];

// Patient replies that refuse or hand off an exam. The patient must never say these.
const REFUSALS = [
  "متأسفم، من نمی‌توانم معاینه کنم. این کار دکتر است.",
  "معاینه کار من نیست، از دکتر بپرسید.",
  "I can't examine myself, the doctor should do it.",
  "I cannot do the exam, that is not my job.",
  "نمی‌توانم بیمار را معاینه کنم",
  "من معاینه نمی‌کنم",
  "Sorry, I am not able to perform a physical exam.",
  "Please ask the doctor to examine me.",
];

const CASE = {
  exam_fa: "معاینه: شکم نرم، بدون تندرنس. ریه‌ها: صدای تنفس طبیعی. قلب: منظم.",
  exam_en: "Exam: abdomen soft, non-tender. Lungs: normal breath sounds. Heart: regular rhythm.",
  vitals: { bp: "120/80", hr: "88", rr: "16", temp: "37.0", spo2: "98" },
};

describe("R64 staff-directed exam requests", () => {
  it.each(STAFF_REQUESTS)("recognises the staff request: %s", (text) => {
    expect(detectExamRequest(text)).toBe(true);
  });

  it.each(PATIENT_QUESTIONS)("keeps the patient question out of exam handling: %s", (text) => {
    expect(detectExamRequest(text)).toBe(false);
  });

  it.each(REFUSALS)("flags a patient refusal or hand-off as a refusal: %s", (text) => {
    expect(deflectsExamRequest(text)).toBe(true);
  });

  it("does not flag an ordinary symptom answer as a refusal", () => {
    expect(deflectsExamRequest("سلام دکتر، درد من از دیروز شروع شد.")).toBe(false);
  });

  it("answers a vitals request from the chart instead of refusing (rule path, no AI key)", async () => {
    const r = await patientReply({ caseData: CASE, userText: "دکتر لطفاً فشار خون بیمار را بگیرید", history: [], lang: "fa", prompts: {}, aiCfg: {} });
    expect(r.mode).toBe("exam");
    expect(r.text).toContain("120/80");
    expect(deflectsExamRequest(r.text)).toBe(false);
  });

  it("the instructor reply reports recorded findings and vitals directly", () => {
    const text = teacherExamReply(CASE, "en", [], { systems: [], vitals: true, full: false });
    expect(text).toContain("120/80");
    expect(text).toMatch(/Supervisor/);
  });
});
