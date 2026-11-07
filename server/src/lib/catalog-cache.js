// Read cache for the learning catalog (flashcards, path nodes, topics).
// The catalog changes rarely but was re-read on every learner request. Entries are
// keyed on the `content` version row that SQLite triggers bump on every write to
// those tables (see db.js), so an admin edit is visible on the very next read.
import { db } from "../db.js";

const memo = new Map();
const MAX_ENTRIES = 64;

function contentVersion() {
  return db.prepare("SELECT v FROM catalog_versions WHERE name = 'content'").get()?.v ?? -1;
}

/** Returns build() once per content version. Callers must treat the value as read-only. */
export function cachedByContent(key, build) {
  const v = contentVersion();
  const hit = memo.get(key);
  if (hit && hit.v === v) return hit.value;
  const value = build();
  if (memo.size >= MAX_ENTRIES) memo.clear();
  memo.set(key, { v, value });
  return value;
}

/** Test helper: drop everything (used when the database is reloaded from a backup). */
export function clearCatalogCache() { memo.clear(); }
