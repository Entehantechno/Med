/* lesson-cache.js — browser-side store for AI-translated lesson text.

   Why IndexedDB (and not the Service Worker Cache API or localStorage):
   • the service worker caches HTTP responses to GET requests only; translations
     come from POST, and need to be stored as structured JSON;
   • localStorage is small (about 5 MB, synchronous) and would be shared by all
     text; IndexedDB holds hundreds of translated reports without blocking UI.

   Every entry is keyed by a deterministic string (see report-translate.js) and
   is bounded (oldest entries are dropped). If IndexedDB is unavailable (private
   mode, disabled storage) the same API falls back to an in-memory map, so the
   app still works and simply translates again after a reload. */

const DB_NAME = "medschool-lesson-cache";
const STORE = "translations";
const MAX_ENTRIES = 600; // translations of cards, reports and notes share this bound

const mem = new Map();
let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("no-indexeddb")); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("idb-open-failed"));
    req.onblocked = () => reject(new Error("idb-blocked"));
  }).catch((e) => { dbPromise = null; throw e; });
  return dbPromise;
}

function run(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    let out;
    try { out = fn(store); } catch (e) { reject(e); return; }
    tx.oncomplete = () => resolve(out && out.result !== undefined ? out.result : undefined);
    tx.onerror = () => reject(tx.error || new Error("idb-tx-failed"));
    tx.onabort = () => reject(tx.error || new Error("idb-tx-aborted"));
  });
}

/* Returns the cached value for `key`, or null. */
export async function getCachedLesson(key) {
  try {
    const db = await openDb();
    const row = await run(db, "readonly", (s) => s.get(key));
    return row && row.value !== undefined ? row.value : null;
  } catch {
    return mem.has(key) ? mem.get(key) : null;
  }
}

/* Stores `value` under `key` and trims the store to MAX_ENTRIES. */
export async function putCachedLesson(key, value) {
  mem.set(key, value);
  try {
    const db = await openDb();
    await run(db, "readwrite", (s) => s.put({ key, value, savedAt: Date.now() }));
    // Count first: reading every row on each save would be wasteful once the cache is full.
    const n = await run(db, "readonly", (s) => s.count());
    if (Number(n) > MAX_ENTRIES) {
      const rows = await run(db, "readonly", (s) => s.getAll());
      const stale = rows.sort((a, b) => a.savedAt - b.savedAt).slice(0, rows.length - MAX_ENTRIES);
      await run(db, "readwrite", (s) => { for (const r of stale) s.delete(r.key); });
    }
  } catch { /* memory copy already stored */ }
}

/* Called on sign-out: translated text is personal (it is written about the
   learner's own attempt), so it must not survive on a shared device. */
export async function clearLessonCache() {
  mem.clear();
  try {
    const db = await openDb();
    await run(db, "readwrite", (s) => s.clear());
  } catch { /* nothing persisted */ }
}
