/* R60 — flashcard navigation flags (back-navigation / answer change).
   Resolution order: class or exam row → university row → global setting → OFF. */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "child_process";
import { db, initDb } from "../src/db.js";
import {
  effectiveFlashAllowBack, effectiveFlashAllowChange, parseLicensingBody, setSetting, getSetting,
} from "../src/lib/orglimits.js";
import { studentSafeFlashcard, changedCardCount } from "../src/lib/flashcard-grade.js";

let uniId = null;
let uniSaved = null;
const saved = {};

beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb();
  const u = db.prepare("SELECT id, flash_allow_back, flash_allow_change FROM universities ORDER BY id LIMIT 1").get();
  uniId = u?.id ?? null;
  uniSaved = u ? { flash_allow_back: u.flash_allow_back, flash_allow_change: u.flash_allow_change } : null;
  for (const k of ["default_flash_allow_back", "default_flash_allow_change"]) saved[k] = getSetting(k);
});

afterAll(() => {
  if (uniId != null) db.prepare("UPDATE universities SET flash_allow_back=?, flash_allow_change=? WHERE id=?")
    .run(uniSaved.flash_allow_back, uniSaved.flash_allow_change, uniId);
  for (const [k, v] of Object.entries(saved)) {
    if (v == null) db.prepare("DELETE FROM settings WHERE key=?").run(k);
    else setSetting(k, v);
  }
});

describe("effectiveFlashAllowBack / Change — tri-state resolution", () => {
  it("defaults to OFF when nothing is set (strict one-way flow)", () => {
    setSetting("default_flash_allow_back", "0");
    setSetting("default_flash_allow_change", "0");
    expect(effectiveFlashAllowBack({ flash_allow_back: null }, null)).toBe(false);
    expect(effectiveFlashAllowChange({ flash_allow_change: null }, null)).toBe(false);
  });

  it("the teacher's row wins over the university and the global default", () => {
    setSetting("default_flash_allow_back", "0");
    expect(effectiveFlashAllowBack({ flash_allow_back: 1 }, null)).toBe(true);
    setSetting("default_flash_allow_back", "1");
    expect(effectiveFlashAllowBack({ flash_allow_back: 0 }, null)).toBe(false);
  });

  it("a NULL row inherits the global default", () => {
    setSetting("default_flash_allow_change", "1");
    expect(effectiveFlashAllowChange({ flash_allow_change: null }, null)).toBe(true);
    setSetting("default_flash_allow_change", "0");
    expect(effectiveFlashAllowChange({ flash_allow_change: null }, null)).toBe(false);
  });

  it("a university override beats the global default but not the row", () => {
    if (uniId == null) return;             // no seeded university in this DB — nothing to override
    setSetting("default_flash_allow_back", "0");
    db.prepare("UPDATE universities SET flash_allow_back=1 WHERE id=?").run(uniId);
    expect(effectiveFlashAllowBack({ flash_allow_back: null }, uniId)).toBe(true);
    expect(effectiveFlashAllowBack({ flash_allow_back: 0 }, uniId)).toBe(false);
    db.prepare("UPDATE universities SET flash_allow_back=0 WHERE id=?").run(uniId);
    setSetting("default_flash_allow_back", "1");
    expect(effectiveFlashAllowBack({ flash_allow_back: null }, uniId)).toBe(false);
  });
});

describe("admin/teacher input — parseLicensingBody accepts the new flags", () => {
  it("normalises on/off to 1/0 and invalid values to inherit (null)", () => {
    const { patch } = parseLicensingBody({ flash_allow_back: "on", flash_allow_change: "inherit" });
    expect(patch.flash_allow_back).toBe(1);
    expect(patch.flash_allow_change).toBe(null);
  });
});

describe("student view of a hotspot card", () => {
  it("never sends a confirm switch or regions — every hotspot is place-then-confirm", () => {
    const out = studentSafeFlashcard({
      id: 9, type: "hotspot", imageUrl: "/x.png", hotspot: { confirm: false, regions: [{ shape: "circle", x: 1, y: 2, r: 3 }] },
    });
    expect(out.hotspot).toEqual({});
  });
});

describe("changedCardCount — server refuses changed answers when disabled (R60)", () => {
  it("counts only cards whose answer was changed after confirm", () => {
    expect(changedCardCount([{ card_id: 1, changes: 0 }, { card_id: 2, changes: 2 }, { card_id: 3 }])).toBe(1);
  });
  it("tolerates missing or malformed input", () => {
    expect(changedCardCount(undefined)).toBe(0);
    expect(changedCardCount("nope")).toBe(0);
    expect(changedCardCount([null, { changes: "x" }])).toBe(0);
  });
});
