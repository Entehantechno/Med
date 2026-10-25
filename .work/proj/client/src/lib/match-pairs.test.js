import { describe, it, expect } from "vitest";
import { clickLeft, clickRight, leftOwnerOf, pairColor, emptyMatch, pairIndexOfLeft, PAIR_COLORS } from "./match-pairs.js";

describe("matching — connect, re-pair, undo (R60)", () => {
  it("links a left item to a right item", () => {
    let s = clickLeft(emptyMatch(), "L1");
    s = clickRight(s, "R1");
    expect(s.pairs).toEqual({ L1: "R1" });
    expect(s.activeLeft).toBe(null);
  });

  it("never creates a duplicate mapping: a used right item moves to the newly selected left item", () => {
    let s = clickRight(clickLeft(emptyMatch(), "L1"), "R1");   // L1-R1
    s = clickRight(clickLeft(s, "L2"), "R1");                  // now L2-R1, L1 free
    expect(s.pairs).toEqual({ L2: "R1" });
    expect(Object.values(s.pairs).filter((v) => v === "R1").length).toBe(1);
  });

  it("re-pairs a linked left item to another right item", () => {
    let s = clickRight(clickLeft(emptyMatch(), "L1"), "R1");   // L1-R1
    s = clickLeft(s, "L1");                                    // unlink + select
    expect(s.pairs).toEqual({});
    expect(s.activeLeft).toBe("L1");
    s = clickRight(s, "R2");
    expect(s.pairs).toEqual({ L1: "R2" });
  });

  it("changing the right item of an already linked left item replaces the old link", () => {
    let s = clickRight(clickLeft(emptyMatch(), "L1"), "R1");
    s = clickRight(clickLeft(s, "L1"), "R2");   // tapping L1 unlinks it first; then R2
    expect(s.pairs).toEqual({ L1: "R2" });
  });

  it("undo: tapping a linked right item with nothing selected unlinks it", () => {
    let s = clickRight(clickLeft(emptyMatch(), "L1"), "R1");
    s = clickRight(s, "R1");
    expect(s.pairs).toEqual({});
  });

  it("tapping a free left item selects it; tapping it again clears the selection", () => {
    let s = clickLeft(emptyMatch(), "L1");
    expect(s.activeLeft).toBe("L1");
    s = clickLeft(s, "L1");
    expect(s.activeLeft).toBe(null);
  });

  it("works with numeric ids, and ids compare as strings", () => {
    let s = clickRight(clickLeft(emptyMatch(), 0), 2);
    expect(leftOwnerOf(s, "2")).toBe("0");
    s = clickRight(clickLeft(s, 1), 2);
    expect(s.pairs[1]).toBe(2);
    expect(s.pairs[0]).toBeUndefined();
  });

  it("a right tap with nothing selected on a free item is a no-op (same object)", () => {
    const s = emptyMatch();
    expect(clickRight(s, "R9")).toBe(s);
  });
});

describe("matching — pair colours", () => {
  it("cycles through a palette of distinct colours", () => {
    expect(new Set(PAIR_COLORS).size).toBe(PAIR_COLORS.length);
    expect(pairColor(0)).toBe(PAIR_COLORS[0]);
    expect(pairColor(PAIR_COLORS.length)).toBe(PAIR_COLORS[0]);
    expect(pairColor(-1)).toBe(PAIR_COLORS[PAIR_COLORS.length - 1]);
  });

  it("maps a left id to its pair index in the left column", () => {
    expect(pairIndexOfLeft(["a", "b", "c"], "b")).toBe(1);
    expect(pairIndexOfLeft([0, 1, 2], "2")).toBe(2);
    expect(pairIndexOfLeft(["a"], "z")).toBe(-1);
  });
});
