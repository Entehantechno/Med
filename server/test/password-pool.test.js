/* password-pool.test.js — argon2 hashing runs in the worker pool; the results must
   match the in-thread path exactly (round trip, wrong password, legacy bcrypt). */
import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";
import { hashPassword, verifyPassword, isArgon2, argon2Ready } from "../src/lib/password.js";

describe("password hashing (worker pool)", () => {
  it("argon2 runtime self-test passes on this host", async () => {
    expect(await argon2Ready()).toBe(true);
  });

  it("hashes with argon2id and verifies the right password only", async () => {
    const h = await hashPassword("correct horse 42");
    expect(isArgon2(h)).toBe(true);
    expect(await verifyPassword("correct horse 42", h)).toBe(true);
    expect(await verifyPassword("correct horse 43", h)).toBe(false);
  });

  it("verifies legacy bcrypt hashes without blocking (async compare)", async () => {
    const legacy = bcrypt.hashSync("old-pass-1", 6);
    expect(await verifyPassword("old-pass-1", legacy)).toBe(true);
    expect(await verifyPassword("old-pass-2", legacy)).toBe(false);
  });

  it("handles a burst of concurrent verifies (queueing across workers)", async () => {
    const h = await hashPassword("burst-pass");
    const results = await Promise.all(Array.from({ length: 12 }, (_, i) => verifyPassword(i % 2 ? "burst-pass" : "nope", h)));
    expect(results.filter(Boolean).length).toBe(6);
  });
});
