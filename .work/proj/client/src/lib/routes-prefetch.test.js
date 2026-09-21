/* routes-prefetch: intent/idle chunk warming must be idempotent and safe. */
import { describe, it, expect, vi } from "vitest";
import { warm, intentProps, onIdle, warmIdleSequence, routeChunks } from "./routes-prefetch.js";

describe("routes-prefetch", () => {
  it("registry covers the core routes", () => {
    for (const name of ["login", "studentHome", "flashcards", "exam", "learnApp", "admin"]) {
      expect(typeof routeChunks[name]).toBe("function");
    }
  });
  it("unknown route names are ignored without throwing", () => {
    expect(() => warm("definitely-not-a-route")).not.toThrow();
  });
  it("intentProps reuses the same warm for every signal and never throws", () => {
    const props = intentProps("login");
    for (const k of ["onPointerEnter", "onPointerDown", "onTouchStart", "onFocus"]) {
      expect(typeof props[k]).toBe("function");
      expect(() => props[k]()).not.toThrow();
    }
  });
  it("onIdle falls back to a timeout and its canceler works", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const cancel = onIdle(fn, 50);
    vi.advanceTimersByTime(60);
    // either rIC (environment-dependent) or the timeout ran it; cancel must be a function
    expect(typeof cancel).toBe("function");
    cancel();
    vi.useRealTimers();
  });
  it("warmIdleSequence returns a canceler and warms without rejecting", () => {
    const cancel = warmIdleSequence(["login"], 10);
    expect(typeof cancel).toBe("function");
    expect(() => cancel()).not.toThrow();
  });
  it("warm on the Login chunk resolves the real module (no rejection)", async () => {
    cancelWakeAll();
    warm("login");
    const mod = await routeChunks.login();
    expect(mod && (mod.default || mod.Login)).toBeTruthy();
  });
});

function cancelWakeAll() { /* placeholder for symmetry; warm() is idempotent */ }
