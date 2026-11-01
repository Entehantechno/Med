/* import-students.js — operator tool: import a student roster CSV, INSERT-ONLY.
   Run it from the server terminal (cPanel → Terminal, or the host's SSH shell).

   Dry run (default — writes nothing):
       npm run import-students -- ../data/students/ARAK-STUDENTS-IMPORT.csv --university ARAK
   Apply (takes a verified snapshot of the database first):
       npm run import-students -- ../data/students/ARAK-STUDENTS-IMPORT.csv --university ARAK --apply

   File format: see lib/student-roster.js (student_no,name_fa,name_en,field).
   Existing student numbers are never changed. New accounts get the student number
   as their initial password (same rule as the admin "add student" form), so
   students must change it at first sign-in.

   Set DATA_DIR the same way as the website. The website may keep running: the
   database uses WAL mode, so this tool does not block or corrupt it. */
import fs from "fs";
import path from "path";

const args = process.argv.slice(2);
const usage = "usage: npm run import-students -- <roster.csv> [--university ARAK] [--apply]";
const file = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--university");
const uIdx = args.indexOf("--university");
const universityCode = uIdx >= 0 ? String(args[uIdx + 1] || "").trim() : "ARAK";
const apply = args.includes("--apply");

if (!file || !universityCode) { console.error(usage); process.exit(2); }

const { DB_PATH, BACKUPS_DIR } = await import("./lib/paths.js");
if (!fs.existsSync(DB_PATH)) {
  console.error(`No database at ${DB_PATH}. Set DATA_DIR to the folder the website uses. Nothing was changed.`);
  process.exit(1);
}

const { readRosterFile, importStudents } = await import("./lib/student-roster.js");
const roster = readRosterFile(path.resolve(file));
if (!roster.present) { console.error(`Roster file not found: ${file}`); process.exit(1); }

const { initDb, initSchema, createSnapshot, closeDatabase } = await import("./db.js");
await initDb();
initSchema();
try {
  let snapshot = null;
  if (apply) snapshot = path.basename(createSnapshot(BACKUPS_DIR, "pre-import"));
  const result = importStudents(roster.rows, { universityCode, apply });
  console.log(JSON.stringify({
    mode: apply ? "applied" : "dry-run",
    file: path.basename(file),
    rowsRead: roster.rows.length,
    rowsSkippedInFile: roster.problems,
    ...result,
    ...(snapshot ? { snapshot: "backups/" + snapshot } : {}),
  }, null, 2));
  if (!apply) console.log("Dry run: nothing was written. Add --apply to import.");
} finally {
  closeDatabase();
}
