// R89: slow-request log helpers (lib/slow-request.js). The log must never carry query strings.
import { describe, it, expect } from "vitest";
import { slowThresholdMs, slowRequestLine, isSlow } from "../src/lib/slow-request.js";

describe("slow-request log (R89)", () => {
  it("threshold defaults to 1000 ms and reads SLOW_REQUEST_MS", () => {
    expect(slowThresholdMs({})).toBe(1000);
    expect(slowThresholdMs({ SLOW_REQUEST_MS: "250" })).toBe(250);
    expect(slowThresholdMs({ SLOW_REQUEST_MS: "nope" })).toBe(1000);
    expect(slowThresholdMs({ SLOW_REQUEST_MS: "0" })).toBe(1000);
  });
  it("flags only requests at or above the threshold", () => {
    expect(isSlow(999.9, 1000)).toBe(false);
    expect(isSlow(1000, 1000)).toBe(true);
    expect(isSlow(NaN, 1000)).toBe(false);
  });
  it("line has method, route template, status and duration, without the query string", () => {
    const line = slowRequestLine({ method: "get", route: "/api/cases/:id", path: "/api/cases/9?token=secret", status: 200, durMs: 1234.4 });
    expect(line).toBe("[slow] GET /api/cases/:id 200 1234ms");
    expect(line).not.toContain("secret");
    const fallback = slowRequestLine({ method: "POST", path: "/api/x?email=a@b.c", status: 500, durMs: 2000 });
    expect(fallback).toBe("[slow] POST /api/x 500 2000ms");
  });
});
