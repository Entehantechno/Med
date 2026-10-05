/* ================================================================
   bankbootstrap.js — load the shipped question banks into the database.

   WHY THIS EXISTS
   ---------------
   The past-exam banks (neurology, infectious diseases) travel with the release
   as JSON payload files under `tools/<subject>-bank/`. Until now the only way
   to get them into a running site was for an operator to POST each file to
   /api/admin/official-question-import/commit by hand after deploying.

   That is a silent failure mode: if nobody runs the command, the site starts
   perfectly happily with an EMPTY learning path and an empty content table —
   no error anywhere, just no questions. That is precisely what happened on the
   first real upload.

   So the import now runs itself on startup. It is:

     * idempotent — the importer skips any question whose fingerprint is already
       present, so restarting the server never duplicates the bank;
     * incremental — adding a new subject's payload to a later release imports
       only the new questions;
     * non-destructive — it never deletes or edits anything a human authored;
     * silent when there is nothing to do, loud when it actually imports.

   Set MEDSCHOOL_SKIP_BANK_IMPORT=1 to opt out (useful for tests that want a
   deliberately empty bank).
   ================================================================ */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "../db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* The banks live outside `server/`, next to it in the release tree:
     <release>/server/src/lib/bankbootstrap.js   <- here
     <release>/tools/neurology-bank/import-payload.part01.json
   Walk up until we find a directory that contains `tools`. Deployments that
   relocate the server folder still work, because we also accept an explicit
   MEDSCHOOL_BANK_DIR. */
function findToolsDir() {
  if (process.env.MEDSCHOOL_BANK_DIR) return process.env.MEDSCHOOL_BANK_DIR;
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, "tools");
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) return candidate;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}

/* Payload files, in the order they should be applied. A bank may be split into
   numbered parts because the HTTP body limit is 2 MB; the parts are just a
   sequence and must go in order so lesson numbering stays stable. */
function payloadFiles(toolsDir) {
  const out = [];
  let banks = [];
  try {
    banks = fs.readdirSync(toolsDir).filter((d) => d.endsWith("-bank")).sort();
  } catch {
    return out;
  }
  for (const bank of banks) {
    const dir = path.join(toolsDir, bank);
    let names = [];
    try {
      names = fs.readdirSync(dir);
    } catch {
      continue;
    }
    // A bank may ship a single payload, numbered parts, or BOTH: the
    // infectious bank has a curated `import-payload.json` (full lessons) plus
    // `import-payload.book.partNN.json` carrying a large past-exam set that is
    // searchable/exam-only. Named part families are independent of the plain
    // parts, so collect every family rather than letting one replace another.
    const parts = names.filter((n) => /^import-payload\.part\d+\.json$/.test(n)).sort();
    const named = names.filter((n) => /^import-payload\.[a-z0-9-]+\.part\d+\.json$/i.test(n)).sort();
    const single = names.filter((n) => n === "import-payload.json");
    for (const n of (parts.length ? parts : single)) out.push(path.join(dir, n));
    for (const n of named) out.push(path.join(dir, n));
  }
  return out;
}

function bankManifest(files, curatorVersion) {
  const parts = files.map((f) => {
    let st = null; try { st = fs.statSync(f); } catch { /* */ }
    return `${path.basename(path.dirname(f))}/${path.basename(f)}:${st ? st.size : 0}:${st ? Math.floor(st.mtimeMs) : 0}`;
  });
  return `v1|curator=${curatorVersion}|` + parts.join(",");
}

/* Cheap count for the cached path: one SQL aggregate instead of parsing 11k
   JSON blobs (which is what learnCardCount below does). */
function learnCardCountFast() {
  try {
    return db.prepare("SELECT COUNT(*) n FROM flashcards WHERE active=1 AND data_json LIKE '%\"track\":\"learn\"%'").get()?.n ?? 0;
  } catch { return 0; }
}

function learnCardCount() {
  try {
    // Only count cards on the competitive learning track — the demo seed puts
    // other kinds of card in the same table.
    const rows = db.prepare("SELECT data_json FROM flashcards").all();
    let n = 0;
    for (const r of rows) {
      try { if (JSON.parse(r.data_json).track === "learn") n++; } catch { /* skip */ }
    }
    return n;
  } catch {
    return 0;
  }
}

/**
 * Import every shipped bank payload that is not already in the database.
 * Returns a short summary the launcher can log.
 */
export async function ensureQuestionBanks() {
  if (process.env.MEDSCHOOL_SKIP_BANK_IMPORT === "1") return null;

  const toolsDir = findToolsDir();
  if (!toolsDir) return null;

  const files = payloadFiles(toolsDir);
  if (!files.length) return null;

  // Warm-boot fast path. The 54 payload parts (~49 MB of JSON) used to be
  // read, parsed and fingerprint-checked on EVERY start — even when nothing
  // had changed — which cost 15-60 s and ~350 MB of RAM on a shared host and
  // made Passenger's first request time out ("site never comes up"). Now the
  // shipped set is described by a small manifest (name + size + mtime of each
  // part, plus the curator version); when it matches what this database last
  // imported, the whole pass is skipped in ~1 ms. Any new/changed part, a new
  // curator, or a manual reset (`MEDSCHOOL_FORCE_BANK_IMPORT=1`) runs it again.
  const { getSetting, setSetting } = await import("../routes/content.js");
  const { CURATOR_VERSION } = await import("./pathcurator.js");
  const manifest = bankManifest(files, CURATOR_VERSION);
  const lastManifest = getSetting("bank_import_manifest", null);
  if (process.env.MEDSCHOOL_FORCE_BANK_IMPORT !== "1" && lastManifest === manifest) {
    return { files: files.length, inserted: 0, skipped: 0, failed: 0, before: -1, after: learnCardCountFast(), subjects: [], curation: { skipped: true }, cached: true };
  }

  // Imported lazily: this module is loaded during startup, and admin.js pulls in
  // a large dependency graph we do not want to pay for when there is nothing to
  // import.
  const { commitOfficialImport } = await import("../routes/admin.js");

  // A synthetic actor so the change log shows who added these rows. It is not a
  // real user row, and recordImport tolerates that.
  const actor = { id: null, username: "system", name_fa: "ورود خودکار بانک سؤال" };

  const before = learnCardCount();
  let inserted = 0, skipped = 0, failed = 0;
  const subjects = new Set();

  // sql.js is fully synchronous, so a 60 s first-run import would block the
  // event loop and the "preparing…" placeholder page (index.js) could not be
  // served — Passenger/cPanel then reports the app as dead. Yield between
  // parts so pending HTTP requests are answered in the gaps.
  const yieldToLoop = () => new Promise((r) => setImmediate(r));
  for (const file of files) {
    await yieldToLoop();
    let body;
    try {
      body = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (e) {
      failed++;
      console.warn(`   ⚠️  bank file unreadable: ${path.basename(file)} — ${e.message}`);
      continue;
    }
    try {
      const out = commitOfficialImport(body, actor);
      inserted += out.inserted || 0;
      skipped += out.skipped || 0;
      if (body.subject_fa) subjects.add(body.subject_fa);
    } catch (e) {
      failed++;
      console.warn(`   ⚠️  bank import failed for ${path.basename(file)} — ${e.message}`);
    }
  }

  // Re-organise imported questions into a curated FREE path (one explicit
  // stage per chapter + subject floor) and the PREMIUM question bank (every
  // remaining question). Cheap and idempotent; runs whenever the shipped
  // bank set changes, or on the first boot that ships the curator.
  let curation = null;
  try {
    const { curateOfficialPath } = await import("./pathcurator.js");
    // Re-run when something was imported (new/changed payloads) or the curator
    // logic itself is newer than what this database last saw.
    const stamp = Number(getSetting("path_curator_version", 0) || 0);
    if (inserted > 0 || stamp < CURATOR_VERSION) {
      curation = curateOfficialPath({ force: inserted > 0 || stamp < CURATOR_VERSION });
    }
  } catch (e) {
    console.warn(`   ⚠️  path curation failed — ${e.message}`);
  }

  // Remember what was imported so the next boot can skip straight past it.
  // Only when every file was processed (a failed part must be retried).
  if (!failed) { try { setSetting("bank_import_manifest", manifest); } catch { /* */ } }

  const after = learnCardCount();
  return {
    files: files.length, inserted, skipped, failed,
    before, after, subjects: [...subjects], curation,
  };
}
