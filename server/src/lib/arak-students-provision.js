/* arak-students-provision.js — idempotent, INSERT-ONLY provisioning of the
   Arak University of Medical Sciences student roster (server/src/data/arak-students.json).
   Adds only students whose student number does not exist yet. Never updates,
   moves, deactivates or deletes an existing account. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db, persistNow } from "../db.js";
import { hashPasswordSync } from "./password.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROSTER_FILE = path.join(__dirname, "..", "data", "arak-students.json");

export function ensureArakStudents() {
  const result = { universityId: null, inserted: 0, existing: 0, invalid: 0, skippedOtherUniversity: 0 };
  const uni = db.prepare("SELECT id FROM universities WHERE code='ARAK' AND retired_at IS NULL ORDER BY id LIMIT 1").get();
  if (!uni) return { ...result, skipped: "no_arak_university" };
  result.universityId = uni.id;
  let roster;
  try { roster = JSON.parse(fs.readFileSync(ROSTER_FILE, "utf8")); }
  catch (e) { return { ...result, skipped: "roster_unreadable:" + (e?.message || e) }; }
  if (!Array.isArray(roster)) return { ...result, skipped: "roster_invalid" };
  const findByNo = db.prepare("SELECT id, university_id FROM users WHERE student_no=?");
  const findByUsername = db.prepare("SELECT id FROM users WHERE username=?");
  const insert = db.prepare("INSERT INTO users (username,password_hash,name_fa,name_en,student_no,role,status,university_id) VALUES (?,?,?,?,?,'student','active',?)");
  const seen = new Set();
  db.transaction(() => {
    for (const s of roster) {
      const no = String(s?.student_no ?? "").trim().replace(/\u200c/g, "");
      const name = String(s?.name_fa ?? "").trim();
      if (!/^\d{8,16}$/.test(no) || !name || seen.has(no)) { result.invalid++; continue; }
      seen.add(no);
      const existing = findByNo.get(no);
      if (existing) { if (Number(existing.university_id) === Number(uni.id)) result.existing++; else result.skippedOtherUniversity++; continue; }
      if (findByUsername.get(no)) { result.skippedOtherUniversity++; continue; }
      insert.run(no, hashPasswordSync(no), name, String(s?.name_en || name).trim() || name, no, uni.id);
      result.inserted++;
    }
  })();
  if (result.inserted) persistNow({ throwOnError: false });
  return result;
}
