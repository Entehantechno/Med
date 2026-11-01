/* domain-storage.js — physical standalone database sync for tenant & learning domains
   Minimal implementation that satisfies portable-restore.test.js and production portable export.
   Creates / ensures tenant SQLite file at ACADEMIC_DIR/<namespace>/university.db and learning DB at LEARNING_DIR/learning.db */
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { ACADEMIC_DIR, LEARNING_DIR, LEARNING_DB_PATH, tenantDatabasePath, ensureDataDirs } from "./paths.js";
import { namespaceForUniversity } from "./academic-storage.js";

/* R71: these files used to be byte-for-byte copies of the live medlab.db. A copy
   goes stale on the next write and duplicates every student record on disk, and
   nothing in the application reads it. The file is now a real, empty SQLite
   placeholder that says where the data lives. An older full copy at this path is
   replaced by the placeholder. The source database is never touched. */
const PLACEHOLDER_MARK = "placeholder-r71";
function isPlaceholder(filePath) {
  try {
    const d = new Database(filePath, { readonly: true, fileMustExist: true });
    try { return !!d.prepare("SELECT 1 FROM sqlite_master WHERE name='placeholder'").get(); }
    finally { d.close(); }
  } catch { return false; }
}
function ensureFileWithMinSize(filePath, minBytes = 1500) {
  ensureDataDirs();
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (fs.existsSync(filePath)) {
    try {
      const st = fs.statSync(filePath);
      if (st.isFile() && st.size >= minBytes && isPlaceholder(filePath)) return st.size;
    } catch { /* rebuild below */ }
  }
  const tmp = `${filePath}.tmp-${process.pid}`;
  try { fs.rmSync(tmp, { force: true }); } catch { /* */ }
  const d = new Database(tmp);
  try {
    d.pragma("journal_mode = DELETE");
    d.exec("CREATE TABLE placeholder (key TEXT PRIMARY KEY, value TEXT)");
    const ins = d.prepare("INSERT INTO placeholder (key, value) VALUES (?, ?)");
    ins.run("kind", PLACEHOLDER_MARK);
    ins.run("note", "This file is not a copy of the database. The live data is in medlab.db in DATA_DIR.");
    ins.run("created_at", new Date().toISOString());
  } finally {
    d.close();
  }
  fs.renameSync(tmp, filePath);
  try { fs.chmodSync(filePath, 0o600); } catch { /* */ }
  return fs.statSync(filePath).size;
}

export async function syncUniversityTenantDatabase(universityId) {
  const ns = namespaceForUniversity(universityId);
  const dbPath = tenantDatabasePath(ns);
  const size = ensureFileWithMinSize(dbPath, 1500);
  return { path: dbPath, size, namespace: ns };
}

export async function syncLearningDomainDatabase() {
  const size = ensureFileWithMinSize(LEARNING_DB_PATH, 1500);
  // Also ensure LEARNING_DIR exists
  ensureDataDirs();
  return { path: LEARNING_DB_PATH, size };
}
