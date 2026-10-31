// Round 67: "where is the pain?" must be answered with a body site.
// The mock patient used to match any clause containing "درد"/"pain", so the
// onset clause ("pain started 2 hours ago...") was returned as the location.
import { describe, it, expect } from "vitest";
import { mockPatientReply, splitStudentQuestions } from "../src/lib/ai-engine.js";

const chestCase = {
  chief_fa: "درد فشارنده قفسه سینه از ۲ ساعت پیش",
  chief_en: "Crushing chest pain for 2 hours",
  history_fa: "درد از ۲ ساعت پیش هنگام فعالیت شروع شده، فشارنده و با انتشار به بازوی چپ و فک، همراه با تعریق و تهوع، با استراحت بهبود نمی‌یابد.",
  history_en: "Pain started 2 hours ago on exertion, crushing, radiating to left arm and jaw, with sweating and nausea, not relieved by rest.",
};

const fullCase = { ...chestCase, age: 58, sex: "male", pmh_fa: "فشار خون بالا، دیابت نوع ۲", pmh_en: "Hypertension, type 2 diabetes" };

describe("R67 patient answers: radiation, age, sex, relief, history", () => {
  it("'منتشر' (radiating) is a radiation question, not a location one", () => {
    const a = mockPatientReply(fullCase, "درد به کجا منتشر می‌شود؟", "fa");
    expect(a).toContain("بازو");
    expect(a).not.toContain("قفسه سینه");
  });
  it("age is answered from the chart", () => {
    expect(mockPatientReply(fullCase, "چند سالتان است؟", "fa")).toContain("58");
    expect(mockPatientReply(fullCase, "How old are you?", "en")).toContain("58 years old");
  });
  it("a chart without an age says so instead of inventing one", () => {
    expect(mockPatientReply({ ...chestCase }, "چند سالتان است؟", "fa")).toMatch(/ذکر نشده/);
  });
  it("sex is answered from the chart", () => {
    expect(mockPatientReply(fullCase, "جنسیت شما چیست؟", "fa")).toContain("مرد");
  });
  it("relief with rest is answered from the history text (not relieved)", () => {
    const a = mockPatientReply(fullCase, "درد با استراحت بهتر می‌شود؟", "fa");
    expect(a).toContain("بهبود نمی‌یابد");
  });
  it("diabetes question is answered from the past history", () => {
    expect(mockPatientReply(fullCase, "قند خون دارید؟", "fa")).toContain("دیابت");
  });
  it("onset phrased as 'شروع شد' is answered as onset", () => {
    const a = mockPatientReply(fullCase, "درد هنگام فعالیت شروع شد؟", "fa");
    expect(a).toMatch(/ساعت پیش/);
  });
});

describe("R67 location questions name the body site", () => {
  it("Persian: 'درد کجاست؟' names the chest, not the onset", () => {
    const a = mockPatientReply(chestCase, "درد کجاست؟", "fa");
    expect(a).toContain("سینه");
    expect(a).not.toMatch(/ساعت پیش|شروع/);
  });

  it("Persian: 'محل درد کجاست؟' also names the chest", () => {
    expect(mockPatientReply(chestCase, "محل درد کجاست؟", "fa")).toContain("قفسه سینه");
  });

  it("English: 'where is the pain?' names the chest", () => {
    const a = mockPatientReply(chestCase, "where is the pain?", "en");
    expect(a.toLowerCase()).toContain("chest");
    expect(a).not.toMatch(/hours?/i);
  });

  it("a chart with no body site does not invent one", () => {
    const a = mockPatientReply({ history_fa: "درد از ۲ ساعت پیش هنگام فعالیت شروع شده" }, "درد کجاست؟", "fa");
    expect(a).not.toMatch(/سینه|شکم|پشت/);
  });

  it("two questions in one message: location and onset are both answered", () => {
    expect(splitStudentQuestions("درد کجاست؟ از کی شروع شد؟")).toHaveLength(2);
  });
});
