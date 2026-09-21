/* paths.js — single source of truth for where PERSISTENT DATA lives.

   Why this exists (upgrade safety): the database, uploaded media and backups
   must live OUTSIDE the application code so you can replace the code with a new
   version WITHOUT losing your data. Everything persistent goes under one folder
   — DATA_DIR — which you keep across upgrades.

   DATA_DIR resolution order:
     1. process.env.DATA_DIR   (absolute, or relative to the app root cwd)
     2. <parentOfProjectRoot>/medschool-data   (default — a SIBLING of the app
        folder, so it survives replacing the whole app folder on upgrade)

   Layout:
     DATA_DIR/
       medlab.db        ← the SQLite database (ALL data: users, questions,
                          flashcards, cases, blog + revisions, progress,
                          settings — literally everything)
       uploads/         ← teacher/admin uploaded images & videos
       backups/         ← automatic database backups (one per server start)

   UPGRADE SAFETY: because DATA_DIR lives OUTSIDE the application folder, you can
   upgrade by ANY method — delete-and-reupload the whole folder, or overwrite in
   place — and your data is untouched. A fresh backup is also taken on every
   start (in backups/) before migrations run, so a bad upgrade is recoverable. */
import "../load-env.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// server/src/lib -> server/src -> server -> <projectRoot>
const PROJECT_ROOT = path.join(__dirname, "..", "..", "..");

// Default (no DATA_DIR set): a SIBLING folder next to the app, e.g.
// <parent>/medschool-data. Living OUTSIDE the app folder means deleting or
// replacing the app folder on upgrade never touches the data.
export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(PROJECT_ROOT, "..", "medschool-data");

export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
export const BACKUPS_DIR = path.join(DATA_DIR, "backups");
// DB filename can still be overridden (used by tests / shot servers), but it
// now lives inside DATA_DIR by default.
export const DB_FILE = process.env.DB_FILE || "medlab.db";
export const DB_PATH = path.isAbsolute(DB_FILE) ? DB_FILE : path.join(DATA_DIR, DB_FILE);

// Bundled demo assets that ship WITH the code (referenced by the seed). We copy
// them into the persistent uploads folder on first run so they're served, while
// never clobbering anything the user has uploaded.
const BUNDLED_UPLOADS = path.join(__dirname, "..", "..", "uploads");

export function ensureDataDirs() {
  for (const d of [DATA_DIR, UPLOADS_DIR, BACKUPS_DIR]) {
    try { fs.mkdirSync(d, { recursive: true }); } catch { /* */ }
  }
  // seed bundled demo assets into the live uploads dir if they're not there yet
  try {
    if (fs.existsSync(BUNDLED_UPLOADS) && path.resolve(BUNDLED_UPLOADS) !== path.resolve(UPLOADS_DIR)) {
      for (const f of fs.readdirSync(BUNDLED_UPLOADS)) {
        const dest = path.join(UPLOADS_DIR, f);
        if (!fs.existsSync(dest)) {
          try { fs.copyFileSync(path.join(BUNDLED_UPLOADS, f), dest); } catch { /* */ }
        }
      }
    }
  } catch { /* best-effort */ }
  return { DATA_DIR, UPLOADS_DIR, BACKUPS_DIR, DB_PATH };
}
