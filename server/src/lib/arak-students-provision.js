/* arak-students-provision.js — boot-time, INSERT-ONLY import of the Arak University
   roster, from an OPTIONAL file in the persistent data folder:

       DATA_DIR/rosters/ARAK-STUDENTS-IMPORT.csv   (override: ARAK_ROSTER_FILE)

   R71: the roster is no longer bundled in the code. If the file is missing this is a
   no-op. If it is present, students whose student number does not exist yet are
   added. Nothing is ever updated, moved or deleted. The same file can be imported
   by hand with `node src/import-students.js <file> --university ARAK --apply`. */
import fs from "fs";
import path from "path";
import { DATA_DIR } from "./paths.js";
import { readRosterFile, importStudents } from "./student-roster.js";

export const ARAK_ROSTER_FILE = process.env.ARAK_ROSTER_FILE
  || path.join(DATA_DIR, "rosters", "ARAK-STUDENTS-IMPORT.csv");

export function ensureArakStudents() {
  const base = { universityId: null, inserted: 0, existing: 0, invalid: 0, skippedOtherUniversity: 0 };
  if (!fs.existsSync(ARAK_ROSTER_FILE)) return { ...base, skipped: "no_roster_file" };
  let roster;
  try { roster = readRosterFile(ARAK_ROSTER_FILE); }
  catch (e) { return { ...base, skipped: "roster_unreadable:" + (e?.message || e) }; }
  const r = importStudents(roster.rows, { universityCode: "ARAK", apply: true });
  return {
    universityId: r.universityId,
    inserted: r.inserted,
    existing: r.existing,
    invalid: roster.problems.length,
    skippedOtherUniversity: r.skippedOtherUniversity,
    ...(r.skipped ? { skipped: r.skipped } : {}),
  };
}
