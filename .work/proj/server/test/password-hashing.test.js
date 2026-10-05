/* ================================================================
   password-hashing.test.js — argon2id preferred hashing, bcrypt
   fallback verification, and the lazy rehash decision.
   ================================================================ */
import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";
import {
  hashPassword, verifyPassword, needsRehash, hashPasswordSync,
  isArgon2, BCRYPT_COST,
} from "../src/lib/password.js";

describe("password hashing", () => {
  it("produces argon2id when the optional WASM module is available, else bcrypt", async () => {
    const h = await hashPassword("S3cret-pw!");
    const verified = await verifyPassword("S3cret-pw!", h);
    expect(verified).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
    if (h.startsWith("$argon2id$")) expect(isArgon2(h)).toBe(true);
    else expect(h.startsWith("$2")).toBe(true);
  });

  it("still verifies legacy bcrypt hashes and flags them for upgrade", async () => {
    const legacy = bcrypt.hashSync("old-demo", BCRYPT_COST);
    expect(await verifyPassword("old-demo", legacy)).toBe(true);
    expect(await verifyPassword("nope", legacy)).toBe(false);
    const shouldUpgrade = await needsRehash(legacy);
    // upgrade only possible when hash-wasm is installed (it is in dev)
    if ((await hashPassword("x")).startsWith("$argon2id$")) expect(shouldUpgrade).toBe(true);
  });

  it("never flags an argon hash for rehashing", async () => {
    const h = await hashPassword("abc");
    if (h.startsWith("$argon2id$")) expect(await needsRehash(h)).toBe(false);
  });

  it("sync bcrypt helper keeps working for bulk imports", () => {
    const h = hashPasswordSync("demo1234");
    expect(h.startsWith("$2")).toBe(true);
    expect(bcrypt.compareSync("demo1234", h)).toBe(true);
  });

  it("treats missing/garbage hashes safely", async () => {
    expect(await verifyPassword("x", null)).toBe(false);
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "not-a-hash")).toBe(false);
  });
});
