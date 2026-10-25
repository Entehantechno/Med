/* ================================================================
   validate.test.js — central input validation: types, ranges,
   strict unknown-key rejection (mass-assignment guard), nested
   arrays and the Express middleware.
   ================================================================ */
import { describe, it, expect } from "vitest";
import { validate, validateBody, s } from "../src/lib/validate.js";

describe("scalar schemas", () => {
  it("validates strings and enforces length", () => {
    const sh = { name: s.str({ min: 1, max: 5 }) };
    expect(validate(sh, { name: "abc" }).ok).toBe(true);
    expect(validate(sh, { name: "" }).ok).toBe(false);
    expect(validate(sh, { name: "abcdef" }).errors[0]).toMatch(/too long/);
    expect(validate(sh, { name: 42 }).ok).toBe(false);
    // trimming
    expect(validate({ name: s.str({ min: 1 }) }, { name: " x " }).value.name).toBe("x");
  });
  it("validates numbers with min/max/integer", () => {
    const sh = { points: s.num({ min: 0, max: 100 }), qty: s.int({ min: 1 }) };
    expect(validate(sh, { points: 12.5, qty: 3 }).ok).toBe(true);
    expect(validate(sh, { points: 101, qty: 3 }).ok).toBe(false);
    expect(validate(sh, { points: 1, qty: 1.5 }).ok).toBe(false);
    expect(validate(sh, { points: "x", qty: 1 }).ok).toBe(false);
  });
  it("validates booleans with coercion opt-in", () => {
    const sh = { flag: s.bool() };
    expect(validate(sh, { flag: true }).value.flag).toBe(true);
    expect(validate(sh, { flag: "true" }).ok).toBe(false);
    expect(validate({ flag: s.bool({ coerce: true }) }, { flag: "false" }).value.flag).toBe(false);
  });
  it("validates enums and emails", () => {
    const sh = { status: s.oneOf(["approved", "rejected"]), email: s.str({ email: true }) };
    expect(validate(sh, { status: "approved", email: "a@b.co" }).ok).toBe(true);
    expect(validate(sh, { status: "maybe", email: "a@b.co" }).ok).toBe(false);
    expect(validate(sh, { status: "approved", email: "nope" }).ok).toBe(false);
  });
  it("treats optional fields as missing rather than erroring", () => {
    const sh = { note: s.str({ optional: true, max: 10 }) };
    const r = validate(sh, {});
    expect(r.ok).toBe(true);
    expect("note" in r.value).toBe(false);
  });
});

describe("strict object mode", () => {
  it("rejects unknown keys (mass-assignment protection)", () => {
    const sh = { a: s.str() };
    const r = validate(sh, { a: "x", role: "admin", isAdmin: true });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toContain("role");
  });
  it("rejects prototype pollution keys outright", () => {
    const sh = { a: s.str() };
    // JSON.parse (the real request path) keeps __proto__ as an OWN property
    const body = JSON.parse('{"a":"x","__proto__":{"polluted":true}}');
    expect(validate(sh, body).ok).toBe(false);
    expect({}.polluted).toBeUndefined();
  });
  it("can allow unknown keys when explicitly asked", () => {
    const sh = { a: s.str() };
    expect(validate(sh, { a: "x", extra: 1 }, { allowUnknown: true }).ok).toBe(true);
  });
  it("rejects non-objects and arrays", () => {
    expect(validate({ a: s.str() }, null).ok).toBe(false);
    expect(validate({ a: s.str() }, [1, 2]).ok).toBe(false);
    expect(validate({ a: s.str() }, "str").ok).toBe(false);
  });
});

describe("arrays and nested objects", () => {
  it("validates each element and caps length", () => {
    const sh = { items: s.array(s.int({ min: 0 }), { max: 3 }) };
    expect(validate(sh, { items: [1, 2, 3] }).ok).toBe(true);
    expect(validate(sh, { items: [1, -2] }).ok).toBe(false);
    expect(validate(sh, { items: [1, 2, 3, 4] }).ok).toBe(false);
    expect(validate(sh, { items: "x" }).ok).toBe(false);
  });
  it("validates nested objects", () => {
    const sh = { meta: s.object({ active: s.bool(), count: s.int({ min: 0 }) }) };
    expect(validate(sh, { meta: { active: true, count: 2 } }).ok).toBe(true);
    const bad = validate(sh, { meta: { active: true, count: -1 } });
    expect(bad.ok).toBe(false);
    // unknown nested key rejected
    expect(validate(sh, { meta: { active: true, count: 1, x: 1 } }).ok).toBe(false);
  });
});

describe("validateBody middleware", () => {
  it("returns 400 + replaces req.body with the sanitised value", () => {
    const mw = validateBody({ name: s.str({ max: 10 }) });
    const req = { body: { name: " ok ", sneaky: 1 } };
    let code = 200; let payload = null;
    const res = { status(c) { code = c; return this; }, json(p) { payload = p; return this; } };
    let nextCalled = false;
    mw(req, res, () => { nextCalled = true; });
    expect(code).toBe(400);
    expect(payload.error).toBe("validation_failed");
    expect(nextCalled).toBe(false);

    const req2 = { body: { name: " ok " } };
    mw(req2, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    expect(req2.body).toEqual({ name: "ok" });
  });
});
