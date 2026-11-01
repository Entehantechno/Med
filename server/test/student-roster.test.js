/* R71 — student roster import: CSV rules, insert-only behaviour, and the boot
   provisioning that is a no-op without a roster file. */
import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { initDb, initSchema, db } from "../src/db.js";
import { parseCsv, parseRoster, readRosterFile, importStudents } from "../src/lib/student-roster.js";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "med-roster-"));
const rosterFile = path.join(dir, "ARAK-STUDENTS-IMPORT.csv");
process.env.ARAK_ROSTER_FILE = rosterFile;          // read by arak-students-provision.js at import time
let ensureArakStudents;

beforeAll(async () => {
  await initDb();
  initSchema();
  db.prepare("INSERT OR IGNORE INTO universities (name_fa,name_en,code,active) VALUES ('اراک','Arak','ARAK',1)").run();
  db.prepare("INSERT OR IGNORE INTO universities (name_fa,name_en,code,active) VALUES ('تست','Other','R71OTHER',1)").run();
  ({ ensureArakStudents } = await import("../src/lib/arak-students-provision.js"));
});

const uniId = (code) => db.prepare("SELECT id FROM universities WHERE code=?").get(code).id;
const userByNo = (no) => db.prepare("SELECT * FROM users WHERE student_no=?").get(no);

describe("CSV reading", () => {
  it("handles a BOM, CRLF, quoted commas and doubled quotes", () => {
    const rows = parseCsv('\uFEFFstudent_no,name_fa,name_en\r\n1,"احمد, علی","Ali ""A"""\r\n2,سارا,\r\n');
    expect(rows).toEqual([
      ["student_no", "name_fa", "name_en"],
      ["1", "احمد, علی", 'Ali "A"'],
      ["2", "سارا", ""],
    ]);
  });

  it("normalises Persian digits and drops zero-width non-joiners in student numbers", () => {
    const r = parseRoster("student_no,name_fa\n۱۴۰۰۱۱۱۱۴۰۵۸,محمد\u200cرضا\n");
    expect(r.rows).toEqual([{ student_no: "140011114058", name_fa: "محمد\u200cرضا", name_en: "محمد\u200cرضا", field: "" }]);
    expect(r.problems).toEqual([]);
  });

  it("reports every skipped line with its reason", () => {
    const r = parseRoster([
      "student_no,name_fa,name_en,field",
      "12ab,فاطمه,,",          // bad number
      "1234567,,,",            // too short
      "140099990001,,,",       // no name at all
      "140099990002,علی,,",    // ok
      "140099990002,رضا,,",    // duplicate in file
    ].join("\n"));
    expect(r.rows.map((x) => x.student_no)).toEqual(["140099990002"]);
    expect(r.problems.map((p) => p.reason)).toEqual(["bad_student_no", "bad_student_no", "missing_name", "duplicate_in_file"]);
  });

  it("rejects a file without a student_no column", () => {
    expect(parseRoster("name,fa\nx,y\n").problems[0].reason).toBe("missing_student_no_column");
  });

  it("a missing roster file is 'nothing to do', not an error", () => {
    expect(readRosterFile(path.join(dir, "absent.csv")).present).toBe(false);
  });
});

describe("boot provisioning (ensureArakStudents)", () => {
  it("is a no-op when the roster file is missing", () => {
    expect(fs.existsSync(rosterFile)).toBe(false);
    const before = db.prepare("SELECT COUNT(*) n FROM users").get().n;
    const r = ensureArakStudents();
    expect(r.skipped).toBe("no_roster_file");
    expect(r.inserted).toBe(0);
    expect(db.prepare("SELECT COUNT(*) n FROM users").get().n).toBe(before);
  });

  it("is insert-only: adds new numbers and never changes an existing account", () => {
    // An existing account with a number on the roster, with its own name and password.
    db.prepare("INSERT INTO users (username,password_hash,name_fa,name_en,student_no,role,status,university_id) VALUES ('140099991000','HASH-KEEP','نام قدیمی','old','140099991000','student','active',?)").run(uniId("ARAK"));
    fs.writeFileSync(rosterFile, "\uFEFFstudent_no,name_fa,name_en,field\r\n140099991000,نام جدید,new,\r\n140099991001,دانشجوی جدید,,پزشکی\r\n");
    const first = ensureArakStudents();
    expect(first.inserted).toBe(1);
    expect(first.existing).toBe(1);
    const kept = db.prepare("SELECT name_fa, password_hash FROM users WHERE username='140099991000'").get();
    expect(kept).toEqual({ name_fa: "نام قدیمی", password_hash: "HASH-KEEP" });
    const added = userByNo("140099991001");
    expect(added.role).toBe("student");
    expect(added.university_id).toBe(uniId("ARAK"));
    expect(added.username).toBe("140099991001");

    const second = ensureArakStudents();           // idempotent
    expect(second.inserted).toBe(0);
    expect(second.existing).toBe(2);
  });

  it("does not take over a number that belongs to another university", () => {
    db.prepare("INSERT INTO users (username,password_hash,name_fa,student_no,role,status,university_id) VALUES ('140099992000','H','دیگر','140099992000','student','active',?)").run(uniId("R71OTHER"));
    fs.writeFileSync(rosterFile, "student_no,name_fa\n140099992000,اراکی\n");
    const r = ensureArakStudents();
    expect(r.inserted).toBe(0);
    expect(r.skippedOtherUniversity).toBe(1);
    expect(userByNo("140099992000").university_id).toBe(uniId("R71OTHER"));
  });
});

describe("importStudents (operator path)", () => {
  it("a dry run writes nothing; apply writes once and is repeatable", () => {
    const rows = [
      { student_no: "140099993001", name_fa: "الف", name_en: "A", field: "" },
      { student_no: "140099993002", name_fa: "ب", name_en: "B", field: "" },
    ];
    const countBefore = db.prepare("SELECT COUNT(*) n FROM users").get().n;
    const dry = importStudents(rows, { universityCode: "ARAK", apply: false });
    expect(dry.toInsert).toBe(2);
    expect(dry.inserted).toBe(0);
    expect(db.prepare("SELECT COUNT(*) n FROM users").get().n).toBe(countBefore);

    const applied = importStudents(rows, { universityCode: "ARAK", apply: true });
    expect(applied.inserted).toBe(2);
    expect(db.prepare("SELECT COUNT(*) n FROM users").get().n).toBe(countBefore + 2);
    expect(importStudents(rows, { universityCode: "ARAK", apply: true }).inserted).toBe(0);
  });

  it("refuses an unknown university code without writing", () => {
    const r = importStudents([{ student_no: "140099994001", name_fa: "x", name_en: "x" }], { universityCode: "NOPE", apply: true });
    expect(r.skipped).toMatch(/no_university/);
    expect(userByNo("140099994001")).toBeUndefined();
  });
});
