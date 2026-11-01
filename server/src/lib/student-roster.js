/* student-roster.js — student roster import (R71). One place for the rules that
   were duplicated in arak-students-provision.js and demo-students.js.

   File format (UTF-8, a BOM is allowed, CRLF or LF, header row required):
       student_no,name_fa,name_en,field
   • student_no: 8–16 digits. Persian and Arabic-Indic digits are converted.
   • name_en is optional (defaults to name_fa); field is optional and informational.

   Rules:
   • INSERT-ONLY. A student number that already exists is never updated, moved,
     deactivated or deleted, whatever university it belongs to.
   • The initial password is the student number, hashed, as in the existing
     admin "add student" rule. Accounts should change it at first sign-in.
   • All inserts happen in one transaction after every hash is computed. */
import fs from "fs";
import { db, durableTransaction } from "../db.js";
import { hashPasswordSync } from "./password.js";
import { toAsciiDigits } from "./digits.js";

const MAX_ROSTER_BYTES = 2 * 1024 * 1024;

/* RFC-4180-style parser: quoted fields, doubled quotes, CR/LF/CRLF, optional BOM. */
export function parseCsv(text) {
  const src = String(text || "").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

/* Returns { rows, problems }. `problems` lists every line that was skipped and why,
   so an operator sees exactly what did not import. */
export function parseRoster(text) {
  const table = parseCsv(text);
  if (!table.length) return { rows: [], problems: [{ line: 0, reason: "empty_file" }] };
  const header = table[0].map((h) => h.trim().toLowerCase());
  const iNo = header.indexOf("student_no");
  if (iNo < 0) return { rows: [], problems: [{ line: 1, reason: "missing_student_no_column" }] };
  const iFa = header.indexOf("name_fa");
  const iEn = header.indexOf("name_en");
  const iField = header.indexOf("field");
  const rows = [];
  const problems = [];
  const seen = new Set();
  for (let r = 1; r < table.length; r++) {
    const line = r + 1;
    const cells = table[r];
    const no = toAsciiDigits(cells[iNo] || "").replace(/\u200c/g, "").trim();
    const nameFa = iFa >= 0 ? String(cells[iFa] || "").trim() : "";
    const nameEn = iEn >= 0 ? String(cells[iEn] || "").trim() : "";
    const field = iField >= 0 ? String(cells[iField] || "").trim() : "";
    if (!/^\d{8,16}$/.test(no)) { problems.push({ line, reason: "bad_student_no", value: no }); continue; }
    if (!nameFa && !nameEn) { problems.push({ line, reason: "missing_name", value: no }); continue; }
    if (seen.has(no)) { problems.push({ line, reason: "duplicate_in_file", value: no }); continue; }
    seen.add(no);
    rows.push({ student_no: no, name_fa: nameFa || nameEn, name_en: nameEn || nameFa, field });
  }
  return { rows, problems };
}

/* Reads a roster file. Returns { present:false } when the file does not exist, which
   callers treat as "nothing to do". Throws only when the file exists but is unusable. */
export function readRosterFile(file) {
  if (!fs.existsSync(file)) return { present: false, rows: [], problems: [] };
  const st = fs.statSync(file);
  if (!st.isFile()) throw new Error("roster_not_a_file");
  if (st.size > MAX_ROSTER_BYTES) throw new Error("roster_too_large");
  return { present: true, ...parseRoster(fs.readFileSync(file, "utf8")) };
}

/* Inserts students that do not exist yet. With apply=false nothing is written and the
   same counts are returned (dry run). */
export function importStudents(rows, { universityCode = "ARAK", apply = true } = {}) {
  const uni = db.prepare("SELECT id FROM universities WHERE code=? AND retired_at IS NULL ORDER BY id LIMIT 1").get(universityCode);
  if (!uni) return { universityId: null, inserted: 0, existing: 0, skippedOtherUniversity: 0, skipped: "no_university:" + universityCode };
  const findByNo = db.prepare("SELECT id, university_id FROM users WHERE student_no=?");
  const findByUsername = db.prepare("SELECT id FROM users WHERE username=?");
  const result = { universityId: uni.id, inserted: 0, existing: 0, skippedOtherUniversity: 0, toInsert: 0 };
  const plan = [];
  for (const s of rows) {
    const existing = findByNo.get(s.student_no);
    if (existing) {
      if (Number(existing.university_id) === Number(uni.id)) result.existing++;
      else result.skippedOtherUniversity++;
      continue;
    }
    if (findByUsername.get(s.student_no)) { result.skippedOtherUniversity++; continue; }
    plan.push({ ...s, hash: hashPasswordSync(s.student_no) });
  }
  result.toInsert = plan.length;
  if (!apply || !plan.length) return { ...result, dryRun: !apply };
  const insert = db.prepare("INSERT INTO users (username,password_hash,name_fa,name_en,student_no,role,status,university_id) VALUES (?,?,?,?,?,'student','active',?)");
  durableTransaction(() => {
    for (const s of plan) insert.run(s.student_no, s.hash, s.name_fa, s.name_en, s.student_no, uni.id);
  });
  result.inserted = plan.length;
  return result;
}
