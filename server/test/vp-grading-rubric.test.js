/* Pure unit tests for the VP grading rubric (no HTTP, no seed). */
import { describe, it, expect } from "vitest";
import {
  applyRubric, normalizeRubric, defaultRubric, scoreRoleWithRubric,
  csvScopeLabel, EXTERN_SCOPE, SECTION_KEYS,
} from "../src/lib/grading-rubric.js";
import { computeSectionScores } from "../src/lib/history-sections.js";

const RESULTS = [
  { id: "a", label: "h", weight: 5, done: true, section: "history" },
  { id: "b", label: "e", weight: 5, done: true, section: "exam" },
  { id: "c", label: "p", weight: 3, done: false, section: "problem_list" },
  { id: "f", label: "d", weight: 2, done: true, section: "ddx" },
  { id: "d", label: "w", weight: 4, done: false, section: "workup" },
  { id: "e", label: "m", weight: 5, done: false, section: "management" },
];

describe("default rubric preserves the original item-pool math", () => {
  it("extern = history+exam+problem_list+ddx pooled weights (12/15 = 80)", () => {
    const ss = applyRubric(RESULTS, null, "fa");
    const legacy = computeSectionScores(RESULTS, "fa");
    expect(ss.overall).toBe(50);
    expect(ss.extern).toBe(80);
    expect(ss.extern).toBe(legacy.extern);
    expect(ss.intern).toBe(legacy.overall);
    expect(EXTERN_SCOPE).toEqual(["history", "exam", "problem_list", "ddx"]);
  });

  it("CSV labels stay stable for the default scopes", () => {
    const r = defaultRubric();
    expect(csvScopeLabel("extern", r.roles.extern)).toBe("extern_score(history+exam+problem_list+ddx)");
    expect(csvScopeLabel("intern", r.roles.intern)).toBe("intern_score(all_sections)");
    expect(r.roles.intern.sections).toEqual(SECTION_KEYS);
  });

  it("garbage input is coerced to the default, never throws", () => {
    expect(() => normalizeRubric(undefined)).not.toThrow();
    expect(() => normalizeRubric("nope")).not.toThrow();
    expect(() => applyRubric(null, { roles: { extern: { sections: ["not-a-section"] } } })).not.toThrow();
    const r = normalizeRubric({ roles: { extern: { sections: ["not-a-section", "history"] } } });
    expect(r.roles.extern.sections).toEqual(["history"]);
  });
});

describe("custom section inclusion and weights", () => {
  it("items mode: intern scored only on history+exam = 10/10 = 100", () => {
    const rubric = {
      roles: {
        intern: { sections: ["history", "exam"], weightMode: "items", sectionWeights: { history: 1, exam: 1 } },
      },
    };
    const ss = applyRubric(RESULTS, rubric, "en");
    expect(ss.intern).toBe(100);
    expect(ss.overall).toBe(50); // overall is still every item
  });

  it("sections mode: empty sections are redistributed, not scored as zero", () => {
    const results = [
      { id: "h", label: "h", weight: 2, done: true, section: "history" },
      { id: "e", label: "e", weight: 2, done: false, section: "exam" },
      // diagnosis has no items — must not pull the average to 0
    ];
    const spec = {
      sections: ["history", "exam", "diagnosis"],
      weightMode: "sections",
      sectionWeights: { history: 1, exam: 1, diagnosis: 5 },
    };
    const out = scoreRoleWithRubric(results, spec, "intern");
    // history 100%, exam 0%, diagnosis dropped → (100+0)/2 = 50
    expect(out.score).toBe(50);
  });

  it("sections mode respects unequal weights", () => {
    const results = [
      { id: "h", label: "h", weight: 1, done: true, section: "history" },
      { id: "e", label: "e", weight: 1, done: false, section: "exam" },
    ];
    const spec = {
      sections: ["history", "exam"],
      weightMode: "sections",
      sectionWeights: { history: 3, exam: 1 },
    };
    const out = scoreRoleWithRubric(results, spec, "extern");
    // (100*3 + 0*1) / 4 = 75
    expect(out.score).toBe(75);
  });
});
