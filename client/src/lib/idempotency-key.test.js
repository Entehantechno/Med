import { describe, it, expect } from "vitest";
import { newIdempotencyKey } from "./idempotency-key.js";

describe("newIdempotencyKey", () => {
  it("returns a URL-safe key of at least 16 characters that is different on each call", () => {
    const a = newIdempotencyKey();
    const b = newIdempotencyKey();
    expect(a).toMatch(/^[A-Za-z0-9-]{16,128}$/);
    expect(b).toMatch(/^[A-Za-z0-9-]{16,128}$/);
    expect(a).not.toBe(b);
  });
});
