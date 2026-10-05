/* No-penalty flashcards: strict vs hint-free server regrading. */
import { describe, it, expect } from "vitest";
import { gradeSubmittedDeckDetailed, hintCountOf } from "../src/lib/flashcard-grade.js";

const mcq = (id, hints = 3, correctIdx = 0) => ({
  id, type: "mcq",
  options: [{ fa: "آ", correct: correctIdx === 0 }, { fa: "ب", correct: correctIdx === 1 }],
  hints_fa: Array.from({ length: hints }, (_, i) => `راهنما ${i + 1}`),
  hints_en: Array.from({ length: hints }, (_, i) => `hint ${i + 1}`),
});

const stepwise = (id) => ({
  id, type: "stepwise",
  steps: [
    { q_fa: "مرحله ۱", answer_fa: "یک" },
    { q_fa: "مرحله ۲", answer_fa: "دو" },
    { q_fa: "مرحله ۳", answer_fa: "سه" },
    { q_fa: "مرحله ۴", answer_fa: "چهار" },
  ],
});

const deck = new Map([[1, mcq(1)], [2, stepwise(2)]]);
const load = (id) => deck.get(id) || null;

describe("hintCountOf", () => {
  it("counts hints (max across languages)", () => {
    expect(hintCountOf(mcq(1, 3))).toBe(3);
    expect(hintCountOf({ hints_fa: ["a"], hints_en: ["a", "b"] })).toBe(2);
    expect(hintCountOf({})).toBe(0);
  });
});

describe("gradeSubmittedDeckDetailed — no-penalty policy", () => {
  it("NO-PENALTY ON: hints are free — 2 hints + correct answer = 100", () => {
    const rows = [{ card_id: 1, selectedIdx: 0, hintsUsed: 2 }];
    const out = gradeSubmittedDeckDetailed(load, rows, [1], { noPenalty: true });
    expect(out.score).toBe(100);
    expect(out.baseScore).toBe(100);
  });

  it("STRICT (default): each hint costs 1/(h+1) of the card — 1 hint of 3 ⇒ 75", () => {
    const rows = [{ card_id: 1, selectedIdx: 0, hintsUsed: 1 }];
    const out = gradeSubmittedDeckDetailed(load, rows, [1], { noPenalty: false });
    expect(out.score).toBe(75);
    expect(out.baseScore).toBe(100); // correctness was full
  });

  it("STRICT: wrong answer stays 0 regardless of hints", () => {
    const rows = [{ card_id: 1, selectedIdx: 1, hintsUsed: 2 }];
    const out = gradeSubmittedDeckDetailed(load, rows, [1], { noPenalty: false });
    expect(out.score).toBe(0);
  });

  it("STRICT: hintLevel aliases hintsUsed; penalty floors at zero, never negative", () => {
    const rows = [{ card_id: 1, selectedIdx: 0, hintLevel: 9 }];
    const out = gradeSubmittedDeckDetailed(load, rows, [1], { noPenalty: false });
    expect(out.score).toBe(0);
  });

  it("multi-part (stepwise): partial credit keeps earned shares; hints deduct only in strict", () => {
    // 2 of 4 stages correct → frac 0.5
    const stepResults = [
      { index: 1, answer: "یک", correct: true },
      { index: 2, answer: "دو", correct: true },
      { index: 3, answer: "غلط", correct: false },
      { index: 4, answer: "غلط", correct: false },
    ];
    const rows = [{ card_id: 2, stepResults, hintsUsed: 0 }];
    const strict = gradeSubmittedDeckDetailed(load, rows, [2], { noPenalty: false });
    const free = gradeSubmittedDeckDetailed(load, rows, [2], { noPenalty: true });
    expect(strict.score).toBe(50);
    expect(free.score).toBe(50);
  });

  it("deck averaging: 1 hinted correct + 1 fully-correct stepwise", () => {
    const rows = [
      { card_id: 1, selectedIdx: 0, hintsUsed: 1 },                                  // strict: 100−25=75
      { card_id: 2, stepResults: [
        { index: 1, answer: "یک", correct: true }, { index: 2, answer: "دو", correct: true },
        { index: 3, answer: "سه", correct: true }, { index: 4, answer: "چهار", correct: true }] }, // 100
    ];
    expect(gradeSubmittedDeckDetailed(load, rows, [1, 2], { noPenalty: false }).score).toBe(88); // (75+100)/2 rounded
    expect(gradeSubmittedDeckDetailed(load, rows, [1, 2], { noPenalty: true }).score).toBe(100);
  });

  it("errors propagate exactly like gradeSubmittedDeck", () => {
    expect(gradeSubmittedDeckDetailed(load, [{ card_id: 1 }, { card_id: 1 }], [1], {}).error).toBe("duplicate_card");
    expect(gradeSubmittedDeckDetailed(load, [{ card_id: 99 }], [1], {}).error).toBe("answers_out_of_deck");
  });
});
