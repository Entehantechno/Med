/* orglimits pure-input helpers: triInput, limitInt, parseLicensingBody. */
import { describe, it, expect } from "vitest";
import { triInput, limitInt, parseLicensingBody, estimateTokens, monthPeriod } from "../src/lib/orglimits.js";

describe("triInput — tri-state feature flags", () => {
  it("maps truthy variants to 1", () => {
    for (const v of [1, true, "on", "1"]) expect(triInput(v)).toBe(1);
  });
  it("maps falsy variants to 0", () => {
    for (const v of [0, false, "off", "0"]) expect(triInput(v)).toBe(0);
  });
  it("maps anything else to null (inherit)", () => {
    for (const v of [null, undefined, "", "inherit", "true", "yes", 2, "onoff"]) expect(triInput(v)).toBe(null);
  });
});

describe("limitInt — nullable non-negative caps", () => {
  it("empty-ish inputs become null (unlimited)", () => {
    for (const v of [null, undefined, ""]) expect(limitInt(v)).toBe(null);
  });
  it("valid numbers pass through as ints", () => {
    expect(limitInt(0)).toBe(0);
    expect(limitInt("250")).toBe(250);
    expect(limitInt(9.9)).toBe(9);
  });
  it("invalid/negative inputs are rejected (undefined)", () => {
    expect(limitInt(-1)).toBe(undefined);
    expect(limitInt("abc")).toBe(undefined);
    expect(limitInt(NaN)).toBe(undefined);
  });
});

describe("parseLicensingBody — licensing payload validation", () => {
  it("empty body → empty patch", () => {
    expect(parseLicensingBody({})).toEqual({ patch: {} });
  });
  it("full valid payload", () => {
    const out = parseLicensingBody({
      limits_enabled: true, max_students: "120", max_vp_msgs_month: 5000, max_vp_tokens_month: null,
      license_plan: "enterprise", license_expires_at: "2027-09-01", sales_method: "سازمانی",
      flash_no_penalty: "off", live_board_speed: "on",
    });
    expect(out.error).toBeUndefined();
    expect(out.patch).toEqual({
      limits_enabled: 1, max_students: 120, max_vp_msgs_month: 5000, max_vp_tokens_month: null,
      license_plan: "enterprise", license_expires_at: "2027-09-01", sales_method: "سازمانی",
      flash_no_penalty: 0, live_board_speed: 1,
    });
  });
  it("rejects bad values with specific errors", () => {
    expect(parseLicensingBody({ max_students: -5 }).error).toBe("invalid_max_students");
    expect(parseLicensingBody({ max_vp_msgs_month: "ز" }).error).toBe("invalid_max_vp_msgs_month");
    expect(parseLicensingBody({ max_vp_tokens_month: -1 }).error).toBe("invalid_max_vp_tokens_month");
    expect(parseLicensingBody({ license_plan: "gold" }).error).toBe("invalid_license_plan");
  });
  it("licensing strings are length-clamped and null-safe", () => {
    const out = parseLicensingBody({ license_expires_at: "x".repeat(100), sales_method: null });
    expect(out.patch.license_expires_at).toHaveLength(40);
    expect(out.patch.sales_method).toBe(null);
  });
  it("caps accept 0 (hard block) and treat blank as unlimited", () => {
    expect(parseLicensingBody({ max_students: 0 }).patch.max_students).toBe(0);
    expect(parseLicensingBody({ max_students: "" }).patch.max_students).toBe(null);
  });
});

describe("estimateTokens / monthPeriod", () => {
  it("token estimate scales with text and floors at 1", () => {
    expect(estimateTokens("")).toBe(1);
    expect(estimateTokens("سلام دنیا")).toBeGreaterThanOrEqual(1);
    const a = estimateTokens("x".repeat(320));
    const b = estimateTokens("x".repeat(3200));
    expect(b).toBeGreaterThan(a * 5);
    expect(estimateTokens({ a: 1 })).toBeGreaterThanOrEqual(1);
  });
  it("month period is YYYY-MM (UTC)", () => {
    expect(monthPeriod(new Date(Date.UTC(2026, 8, 21)))).toBe("2026-09");
    expect(monthPeriod(new Date(Date.UTC(2027, 0, 1)))).toBe("2027-01");
  });
});
