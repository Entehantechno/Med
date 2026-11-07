// Round 66: the virtual patient answers up to THREE questions in one message.
// More than three questions, or three questions that are also long, make the
// patient say they are confused and ask for one question at a time.
import { describe, it, expect } from "vitest";
import {
  patientReply, countStudentQuestions, splitStudentQuestions, tooManyStudentQuestions,
  MAX_SIMULTANEOUS_QUESTIONS, LONG_QUESTION_MESSAGE_CHARS,
} from "../src/lib/ai-engine.js";

const CASE = {
  chief_fa: "درد قفسه سینه",
  history_fa: "درد فشارنده از یک ساعت پیش، انتشار به بازوی چپ",
  social_fa: "سیگاری است، ۲۰ پاکت-سال",
  chief_en: "chest pain",
  history_en: "pressure-like pain for an hour, radiating to left arm",
  social_en: "smokes, 20 pack-years",
};
const ask = (userText, lang = /[\u0600-\u06FF]/.test(userText) ? "fa" : "en") =>
  patientReply({ caseData: CASE, userText, history: [], lang, prompts: {}, aiCfg: {} });

// Long on purpose: each question carries a full clinical detail (over 160 characters in all).
const LONG_THREE_FA =
  "آیا درد شما هنگام راه رفتن یا بالا رفتن از پله‌ها بدتر می‌شود و چه مدتی طول می‌کشد تا دوباره آرام بگیرد؟ " +
  "آیا با استراحت کردن یا تغییر وضعیت بدن کم می‌شود و آیا این درد در شب هم شما را از خواب بیدار می‌کند؟ " +
  "و وقتی فشار شدیدی به قفسهٔ سینه‌تان وارد می‌شود، چه احساسی دارید و آیا همراه آن تنگی نفس یا عرق سرد هم دارید؟";

describe("R66 the question limit", () => {
  it("the limit is three questions", () => {
    expect(MAX_SIMULTANEOUS_QUESTIONS).toBe(3);
  });

  it("two and three short questions are answered, not refused", async () => {
    for (const q of [
      "درد کجاست؟ از کی شروع شد؟",
      "درد کجاست؟ از کی شروع شد؟ سیگار می‌کشید؟",
      "Where does it hurt? When did it start? Smoking?",
    ]) {
      expect(tooManyStudentQuestions(q)).toBe(false);
      const r = await ask(q);
      expect(r.clarify).toBeFalsy();
      expect(r.text).not.toMatch(/گیج|confused/i);
    }
  });

  it("three questions get one answer per question, not only the first topic", async () => {
    const r = await ask("درد کجاست؟ از کی شروع شد؟ سیگار می‌کشید؟");
    expect(r.text).toMatch(/ساعت/);            // onset
    expect(r.text).toMatch(/سیگار/);           // smoking, a different topic
    const en = await ask("Where does it hurt? When did it start? Smoking?");
    expect(en.text).toMatch(/hour/);
    expect(en.text).toMatch(/smokes/);
  });

  it("an unrecognised question is not reported next to real answers", async () => {
    // three questions, the last one is not in the chart: the other two are still answered
    const three = await ask("درد کجاست؟ سیگار می‌کشید؟ مهمانی رفته بودید؟");
    expect(three.text).toMatch(/سیگار/);
    expect(three.text).not.toMatch(/متوجه سؤالتان نشدم/);
  });

  it("four questions: the patient says they are confused and asks one at a time (fa and en)", async () => {
    const fa = await ask("سن شما چند سال است؟ درد کجاست؟ از کی شروع شد؟ سیگار می‌کشید؟");
    expect(fa.clarify).toBe(true);
    expect(fa.text).toMatch(/گیج/);
    expect(fa.text).toMatch(/هر بار فقط یک سؤال/);
    const en = await ask("Where does it hurt? When did it start? Any fever? Smoking?");
    expect(en.clarify).toBe(true);
    expect(en.text).toMatch(/confused/i);
    expect(en.text).toMatch(/one question at a time/i);
  });

  it("three long questions in one message are too much: confused", async () => {
    expect(LONG_THREE_FA.trim().length).toBeGreaterThan(LONG_QUESTION_MESSAGE_CHARS);
    expect(countStudentQuestions(LONG_THREE_FA)).toBe(3);
    expect(tooManyStudentQuestions(LONG_THREE_FA)).toBe(true);
    const r = await ask(LONG_THREE_FA);
    expect(r.clarify).toBe(true);
    expect(r.text).toMatch(/گیج/);
  });

  it("two long questions are still answered (the limit is two-or-three, not length alone)", async () => {
    const two =
      "آیا درد شما هنگام راه رفتن یا بالا رفتن از پله‌ها بدتر می‌شود و چه مدتی طول می‌کشد تا دوباره آرام بگیرد؟ " +
      "آیا با استراحت کردن یا تغییر وضعیت بدن کم می‌شود و آیا این درد در شب هم شما را از خواب بیدار می‌کند؟";
    expect(two.trim().length).toBeGreaterThan(LONG_QUESTION_MESSAGE_CHARS);
    expect(tooManyStudentQuestions(two)).toBe(false);
  });
});

describe("R66 splitting one message into its questions", () => {
  it("splits on question marks and keeps the greeting with the first question", () => {
    expect(splitStudentQuestions("سلام دکتر، درد کجاست؟ از کی شروع شد؟")).toEqual([
      "سلام دکتر، درد کجاست؟",
      "از کی شروع شد؟",
    ]);
  });
  it("a trailing fragment without a mark joins the question before it", () => {
    expect(splitStudentQuestions("درد کجاست؟ و از کی شروع شد")).toEqual(["درد کجاست؟ و از کی شروع شد"]);
  });
  it("unpunctuated interrogative clauses split like the counter", () => {
    expect(splitStudentQuestions("سن شما چند است. درد کجاست. از کی شروع شد.")).toHaveLength(3);
    expect(countStudentQuestions("سن شما چند است. درد کجاست. از کی شروع شد.")).toBe(3);
  });
  it("empty text has no questions", () => {
    expect(splitStudentQuestions("   ")).toEqual([]);
  });
});
