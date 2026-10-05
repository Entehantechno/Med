/* load-env.js — must be imported BEFORE anything that reads process.env
   (DATA_DIR, JWT_SECRET, AI_API_KEY, PORT).

   On a cPanel host the operator should not have to create files by hand:
   if `.env` is missing and `.env.ready` shipped with the zip, we copy it.

   JWT_SECRET is generated PER INSTALLATION. Earlier releases shipped one fixed
   secret inside `.env.ready` — identical on every site and visible to anyone
   holding the zip — which is enough to forge a token for any account. Now a
   blank / known-shipped / weak value is replaced by 48 random bytes on the
   first start and persisted to `.env`, so it survives restarts. */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const ENV_FILE = path.join(ROOT, ".env");
const READY_FILE = path.join(ROOT, ".env.ready");
const SERVER_ENV = path.join(ROOT, "server", ".env");

try {
  if (!fs.existsSync(ENV_FILE) && fs.existsSync(READY_FILE)) {
    fs.copyFileSync(READY_FILE, ENV_FILE);
    console.log("✓ created .env from the bundled .env.ready (no manual step needed)");
  }
} catch (e) {
  console.warn("could not auto-create .env:", e?.message || e);
}

dotenv.config({ path: ENV_FILE });
if (fs.existsSync(SERVER_ENV)) dotenv.config({ path: SERVER_ENV, override: false });

/* Secrets that must never be accepted: the defaults from older docs/zips. */
export const KNOWN_WEAK_SECRETS = [
  "dev-secret", "change-me-in-production", "change-this-secret-in-production",
  "change-this-to-a-long-random-string",
  // shipped in every zip up to v67 — public, therefore useless
  "529a1c5a1a1bc2f60cb6e1cdb8eca545ff12f6bbd41fc4c46f967821c3f5e6b4e0d8fd52a0e98f14679432bf08bc9762",
];

function secretIsUsable(s) {
  const v = String(s || "").trim();
  return v.length >= 32 && !KNOWN_WEAK_SECRETS.includes(v);
}

function writeSecretToEnvFile(file, secret) {
  let text = "";
  try { text = fs.readFileSync(file, "utf8"); } catch { text = ""; }
  const line = `JWT_SECRET=${secret}`;
  if (/^JWT_SECRET=.*$/m.test(text)) text = text.replace(/^JWT_SECRET=.*$/m, line);
  else text = (text ? text.replace(/\s*$/, "\n") : "") + line + "\n";
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, text, { mode: 0o600 });
  fs.renameSync(tmp, file);
  try { fs.chmodSync(file, 0o600); } catch { /* windows / shared hosts */ }
}

if (!secretIsUsable(process.env.JWT_SECRET) && process.env.NODE_ENV !== "test" && !process.env.VITEST) {
  const fresh = crypto.randomBytes(48).toString("hex");
  const target = fs.existsSync(ENV_FILE) || !fs.existsSync(SERVER_ENV) ? ENV_FILE : SERVER_ENV;
  try {
    writeSecretToEnvFile(target, fresh);
    process.env.JWT_SECRET = fresh;
    console.log(`🔐 generated a new JWT_SECRET for this installation (saved to ${path.basename(target)}); existing sessions must sign in again`);
  } catch (e) {
    // Read-only filesystem: still run with an in-memory secret rather than the
    // public one — sessions just won't survive a restart.
    process.env.JWT_SECRET = fresh;
    console.warn("⚠️  could not persist JWT_SECRET to .env (" + (e?.message || e) + "); using a per-process secret");
  }
}
