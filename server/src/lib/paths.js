/* paths.js — durable persistent-data locations, outside the application code.
   Academic and competitive-learning domains are explicit so portable operations
   never mix a university tenant with platform-wide learner data. */
import "../load-env.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, "..", "..", "..");
export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(PROJECT_ROOT, "..", "medschool-data");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
export const BACKUPS_DIR = path.join(DATA_DIR, "backups");
export const ACADEMIC_DIR = path.join(DATA_DIR, "academic");
export const LEARNING_DIR = path.join(DATA_DIR, "learning");
export const PORTABLE_STAGING_DIR = path.join(DATA_DIR, ".portable-staging");
export const DB_FILE = process.env.DB_FILE || "medlab.db";
export const LEARNING_DB_PATH = path.join(LEARNING_DIR, "learning.db");
export function tenantDatabasePath(namespace) {
  return path.join(ACADEMIC_DIR, namespace, "university.db");
}
export const DB_PATH = path.isAbsolute(DB_FILE)
  ? DB_FILE
  : path.join(DATA_DIR, DB_FILE);
const BUNDLED_UPLOADS = path.join(__dirname, "..", "..", "uploads");

export function ensureDataDirs() {
  for (const dir of [
    DATA_DIR,
    UPLOADS_DIR,
    BACKUPS_DIR,
    ACADEMIC_DIR,
    LEARNING_DIR,
    PORTABLE_STAGING_DIR,
  ]) {
    try {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    } catch {
      /* best effort */
    }
  }
  try {
    if (
      fs.existsSync(BUNDLED_UPLOADS) &&
      path.resolve(BUNDLED_UPLOADS) !== path.resolve(UPLOADS_DIR)
    ) {
      for (const name of fs.readdirSync(BUNDLED_UPLOADS)) {
        const src = path.join(BUNDLED_UPLOADS, name);
        const dest = path.join(UPLOADS_DIR, name);
        if (!fs.existsSync(dest)) {
          try {
            fs.copyFileSync(src, dest);
          } catch {
            /* ignore non-files */
          }
        }
      }
    }
  } catch {
    /* best effort */
  }
  return {
    DATA_DIR,
    UPLOADS_DIR,
    BACKUPS_DIR,
    ACADEMIC_DIR,
    LEARNING_DIR,
    PORTABLE_STAGING_DIR,
    DB_PATH,
  };
}
