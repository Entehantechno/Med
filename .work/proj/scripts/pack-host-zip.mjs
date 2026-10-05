#!/usr/bin/env node
/* Lean Hetzner/cPanel zip: source + built client + compiled bank payloads.
   Excludes reports, node_modules, previous zips, runtime DBs, local `.env`,
   internal/planning docs, and the raw question-bank BUILD
   inputs (only compiled tools/*-bank/import-payload*.json files ship).
   Ships `.env.ready` and a generated `.env` so the operator adds nothing. */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const out = process.argv[2] || path.join(root, "MED-School-host.zip");
process.chdir(root);

const raw = execFileSync("find", [".", "-type", "f", "-print"], { encoding: "utf8", maxBuffer: 80 * 1024 * 1024 });
const skip = [
  /(^|\/)node_modules\//,
  /(^|\/)\.git\//,
  /(^|\/)\.arena\//,
  /(^|\/)e2e-data\//,
  /(^|\/)medschool-data\//,
  /(^|\/)playwright-report\//,
  /(^|\/)test-results\//,
  /(^|\/)__pycache__\//,
  /(^|\/)\.venv\//,
  /\.zip$/i,
  /\.(db|sqlite|sqlite3)(-|$|\.)/i,
  /(^|\/)گزارش-/,
  /(^|\/)\.env$/,
  /\/client\/dist\/.*\.map$/,
  // Internal AI-agent guidance — useless (and confusing) on the host.
  /(^|\/)AGENTS\.md$/,
  // Dev planning/chat artifacts must never reach an operator release.
  /(^|\/)پلن-تحقیق/,
  /(^|\/)پلن-توسعه/,
  /(^|\/)ادامه-در-چت/,
  /(^|\/)گزارش\.md$/,
  // Raw question-bank build inputs (scraper pipelines, source PDFs/images,
  // the exam-booklets tooling): zero runtime use; payloads are what the
  // server imports. Also enforced by the bank allow-list below.
  /(^|\/)tools\/[^/]+-bank\/sources\//,
  /(^|\/)tools\/exam-booklets\//,
];
/* Inside tools/*-bank ship ONLY compiled import payloads; everything else in
   those folders (Python scrapers, build.mjs, intermediate bank.json /
   lessons_book*.json) is build-time source material. */
const isBankFile = (f) => /^tools\/[^/]+-bank\//.test(f);
const bankKeep = (f) => /^tools\/[^/]+-bank\/import-payload(\.[a-z0-9-]+)?(\.part\d+)?\.json$/i.test(f);
const files = raw.split("\n")
  .map((s) => s.replace(/^\.\//, "").trim())
  .filter(Boolean)
  .filter((f) => !skip.some((rx) => rx.test(f)))
  .filter((f) => !isBankFile(f) || bankKeep(f));

if (existsSync(out)) unlinkSync(out);
const listPath = "/tmp/medschool-host-zip.list";
writeFileSync(listPath, files.join("\n") + "\n");
execFileSync("zip", ["-q", "-X", "-9", out, "-@"], {
  input: files.join("\n") + "\n",
  maxBuffer: 80 * 1024 * 1024,
});
if (existsSync(".env.ready")) {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "med-env-"));
  copyFileSync(".env.ready", path.join(tmp, ".env"));
  execFileSync("zip", ["-q", "-X", path.resolve(out), ".env"], { cwd: tmp });
  rmSync(tmp, { recursive: true, force: true });
  files.push(".env");
}
console.log(`Wrote ${out} (${files.length} files)`);
