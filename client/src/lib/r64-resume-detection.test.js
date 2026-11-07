// Round 64: resume detection. The server decides whether a session resumed and how much
// time is left; the browser reads those two facts through these helpers.
import { describe, it, expect } from "vitest";
import { remainingFromServer, isResumedSession } from "./resume-state.js";

describe("remainingFromServer", () => {
  it("uses the server's remaining seconds when present", () => {
    expect(remainingFromServer({ remainingSec: 754 }, 900)).toBe(754);
  });

  it("never goes negative: an expired clock reads zero", () => {
    expect(remainingFromServer({ remainingSec: -12 }, 900)).toBe(0);
  });

  it("floors fractional seconds", () => {
    expect(remainingFromServer({ remainingSec: 59.9 }, 900)).toBe(59);
  });

  it("falls back to the caller's default when the server sent no clock", () => {
    expect(remainingFromServer({}, 900)).toBe(900);
    expect(remainingFromServer({ remainingSec: null }, 900)).toBe(900);
    expect(remainingFromServer({ remainingSec: "120" }, 900)).toBe(900);
    expect(remainingFromServer({ remainingSec: NaN }, 900)).toBe(900);
  });

  it("an untimed session stays untimed (null default)", () => {
    expect(remainingFromServer({}, null)).toBeNull();
    expect(remainingFromServer(undefined, null)).toBeNull();
  });

  it("a zero remaining time is kept as zero, not replaced by the default", () => {
    expect(remainingFromServer({ remainingSec: 0 }, 900)).toBe(0);
  });
});

describe("isResumedSession", () => {
  it("is true only when the server restored a saved run", () => {
    expect(isResumedSession({ resumed: true })).toBe(true);
  });

  it("is false for a fresh start, a missing flag, or a non-boolean value", () => {
    expect(isResumedSession({ resumed: false })).toBe(false);
    expect(isResumedSession({})).toBe(false);
    expect(isResumedSession({ resumed: "true" })).toBe(false);
    expect(isResumedSession(null)).toBe(false);
    expect(isResumedSession(undefined)).toBe(false);
  });
});
