/* ================================================================
   itemanalysis.test.js — psychometric item analysis math:
   facility P, discrimination D (27 % groups), hint effectiveness,
   at-risk flags, telemetry clamping, CSV export.
   ================================================================ */
import { describe, it, expect } from "vitest";
import {
  createItemAnalysis, addFlashAnswer, finishItemAnalysis,
  answerTelemetry, itemAnalysisCsv,
} from "../src/lib/itemanalysis.js";

const STUDENTS = (n) => Array.from({ length: n }, (_, i) => ({ id: `s${i}`, avg: 100 - i * 9 }));

describe("answer telemetry clamping", () => {
  it("clamps absurd hint counts and response times", () => {
    expect(answerTelemetry({ hintsUsed: 99999, responseMs: 5 * 3600 * 1000 })).toEqual({ hints: 20, ms: 0 });
    expect(answerTelemetry({ hintsUsed: -5, responseMs: -10 })).toEqual({ hints: 0, ms: 0 });
    expect(answerTelemetry({ hintsUsed: "2", responseMs: "3000" })).toEqual({ hints: 2, ms: 3000 });
    expect(answerTelemetry({})).toEqual({ hints: 0, ms: 0 });
    expect(answerTelemetry({ hintsUsed: NaN, responseMs: "abc" })).toEqual({ hints: 0, ms: 0 });
  });
});

describe("facility and discrimination indices", () => {
  it("computes P and D from top/bottom 27% groups (N >= 6)", () => {
    const ia = createItemAnalysis();
    const members = STUDENTS(10);
    // discriminating item: top 7 right, bottom 3 wrong → groups of 3 → D = 1
    // easy item: everyone right → P = 100, D = 0
    for (const m of members) {
      const i = Number(m.id.slice(1));
      addFlashAnswer(ia, { studentId: m.id, itemKey: "disc", label_fa: "گزینه‌ای", fraction: i < 7 ? 1 : 0, solved: i < 7, hints: 0, ms: 0, createdAt: "2026-09-10T10:00" });
      addFlashAnswer(ia, { studentId: m.id, itemKey: "easy", label_fa: "ساده", fraction: 1, solved: true, hints: 0, ms: 0, createdAt: "2026-09-10T10:00" });
    }
    const f = finishItemAnalysis(ia, members);
    const disc = f.items.find((x) => x.key === "disc");
    expect(disc.facility).toBe(70);
    expect(disc.discrimination).toBe(1);
    expect(disc.hard).toBe(false);
    const easy = f.items.find((x) => x.key === "easy");
    expect(easy.facility).toBe(100);
    expect(easy.discrimination).toBe(0);
    expect(easy.poorDiscrimination).toBe(true);
  });

  it("uses halves for small cohorts (N < 6)", () => {
    const ia = createItemAnalysis();
    const members = STUDENTS(4).map((m, i) => ({ ...m, avg: [90, 80, 30, 20][i] }));
    for (const m of members) {
      const top = m.avg >= 80;
      addFlashAnswer(ia, { studentId: m.id, itemKey: "q", label_fa: "q", fraction: top ? 1 : 0, solved: top, hints: 0, ms: 0, createdAt: "2026-09-10" });
    }
    const f = finishItemAnalysis(ia, members);
    const q = f.items[0];
    expect(q.facility).toBe(50);
    expect(q.discrimination).toBe(1);
    // poor-discrimination flag is only raised for cohorts >= 6
    expect(q.poorDiscrimination).toBe(false);
  });

  it("averages a student's repeated attempts before ranking groups", () => {
    const ia = createItemAnalysis();
    const members = [{ id: "a", avg: 90 }, { id: "b", avg: 30 }];
    addFlashAnswer(ia, { studentId: "a", itemKey: "q", label_fa: "q", fraction: 1, solved: true, hints: 0, ms: 0, createdAt: "2026-09-10" });
    addFlashAnswer(ia, { studentId: "a", itemKey: "q", label_fa: "q", fraction: 0, solved: false, hints: 0, ms: 0, createdAt: "2026-09-11" });
    addFlashAnswer(ia, { studentId: "b", itemKey: "q", label_fa: "q", fraction: 0, solved: false, hints: 0, ms: 0, createdAt: "2026-09-10" });
    const f = finishItemAnalysis(ia, members);
    // a's mean = 0.5, b = 0 → D = 0.5; facility across 3 answers = 33
    const q = f.items[0];
    expect(q.facility).toBe(33);
    expect(q.discrimination).toBe(0.5);
  });
});

describe("hint effectiveness & response time", () => {
  it("splits success rates by hint usage and aggregates time", () => {
    const ia = createItemAnalysis();
    const members = STUDENTS(6);
    for (const m of members) {
      const i = Number(m.id.slice(1));
      // without hints: only top students succeed (4/6)
      addFlashAnswer(ia, { studentId: m.id, itemKey: "q", label_fa: "q", fraction: i < 4 ? 1 : 0, solved: i < 4, hints: 0, ms: 5000, createdAt: "2026-09-10" });
      // with hints: bottom students retry and succeed (hint helps)
      if (i >= 4) addFlashAnswer(ia, { studentId: m.id, itemKey: "q", label_fa: "q", fraction: 1, solved: true, hints: 2, ms: 9000, createdAt: "2026-09-11" });
    }
    const f = finishItemAnalysis(ia, members);
    const q = f.items[0];
    expect(q.noHintSuccess).toBe(67);     // 4/6 rounded
    expect(q.withHintSuccess).toBe(100);  // 2/2
    expect(q.avgSec).toBe(6);             // (6*5 + 2*9)/8
    expect(f.summary.avgHintsPerAnswer).toBeCloseTo(0.5, 1);
  });
});

describe("at-risk learner flags", () => {
  it("flags low score, hint dependence and slowness", () => {
    const ia = createItemAnalysis();
    const members = [
      { id: "good", avg: 95 }, { id: "risk", avg: 40 },
      { id: "hinty", avg: 80 }, { id: "slow", avg: 80 },
      { id: "ok1", avg: 78 }, { id: "ok2", avg: 75 },
    ];
    for (const m of members) {
      if (m.id === "risk") addFlashAnswer(ia, { studentId: m.id, itemKey: "q", label_fa: "q", fraction: 0.2, solved: false, hints: 5, ms: 40000, createdAt: "2026-09-10" });
      else if (m.id === "hinty") addFlashAnswer(ia, { studentId: m.id, itemKey: "q", label_fa: "q", fraction: 0.9, solved: true, hints: 6, ms: 5000, createdAt: "2026-09-10" });
      else if (m.id === "slow") addFlashAnswer(ia, { studentId: m.id, itemKey: "q", label_fa: "q", fraction: 0.85, solved: true, hints: 0, ms: 45000, createdAt: "2026-09-10" });
      else addFlashAnswer(ia, { studentId: m.id, itemKey: "q", label_fa: "q", fraction: 0.9, solved: true, hints: 0, ms: 5000, createdAt: "2026-09-10" });
    }
    const f = finishItemAnalysis(ia, members);
    expect(f.studentCtx.get("risk").reasons).toContain("low_score");
    expect(f.studentCtx.get("hinty").reasons).toContain("hint_dependent");
    expect(f.studentCtx.get("slow").reasons).toContain("slow");
    expect(f.studentCtx.has("good")).toBe(false);
  });
});

describe("CSV export", () => {
  it("emits a Persian header, flags and quoted cells", () => {
    const ia = createItemAnalysis();
    const members = STUDENTS(8);
    for (const m of members) {
      const i = Number(m.id.slice(1));
      addFlashAnswer(ia, { studentId: m.id, itemKey: "q1", topic: "قلب, عروق", label_fa: "سؤال, قلب", fraction: i < 2 ? 0.1 : 0.9, solved: i >= 2, hints: 0, ms: 0, createdAt: "2026-09-10" });
    }
    const { items } = finishItemAnalysis(ia, members);
    const csv = itemAnalysisCsv(items, true);
    expect(csv.startsWith("شناسه/متن سؤال,")).toBe(true);
    expect(csv).toContain('"سؤال, قلب"');
    expect(csv).toContain('"قلب, عروق"');
    const en = itemAnalysisCsv(items, false);
    expect(en.startsWith("Item,Topic,")).toBe(true);
  });
});
