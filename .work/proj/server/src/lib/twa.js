/* twa.js — Trusted Web Activity (Android app) support.

   A TWA lets the PWA run inside a real Android app shell (no browser chrome),
   publishable to Cafe Bazaar / Google Play. For Chrome to hide its address bar
   the site must PROVE it owns the app via a Digital Asset Links file served at
   /.well-known/assetlinks.json that lists the app's package name + the SHA-256
   fingerprint(s) of the signing certificate.

   This module stores an admin-editable TWA config in the `settings` table
   (key = "twa") and renders the assetlinks.json. AI-free, deterministic.
*/
import { db, persistNow } from "../db.js";

const KEY = "twa";

export const DEFAULT_TWA = {
  enabled: false,                 // master switch — off until the admin sets it up
  package_name: "ir.medschool.twa",
  // one or more uppercase colon-separated SHA-256 signing-cert fingerprints.
  // Cafe Bazaar / Play each have their own signing key → list all that apply.
  sha256_fingerprints: [],
};

export function getTwaConfig() {
  const row = db.prepare("SELECT value FROM settings WHERE key=?").get(KEY);
  let saved = {};
  try { saved = row ? JSON.parse(row.value) : {}; } catch { saved = {}; }
  const cfg = { ...DEFAULT_TWA, ...saved };
  cfg.enabled = saved.enabled === true;                 // default OFF
  cfg.package_name = String(saved.package_name || DEFAULT_TWA.package_name).trim();
  cfg.sha256_fingerprints = normalizeFingerprints(saved.sha256_fingerprints);
  return cfg;
}

export function saveTwaConfig(input) {
  const cfg = {
    enabled: input?.enabled === true,
    package_name: String(input?.package_name || DEFAULT_TWA.package_name).trim(),
    sha256_fingerprints: normalizeFingerprints(input?.sha256_fingerprints),
  };
  db.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .run(KEY, JSON.stringify(cfg));
  persistNow();
  return cfg;
}

/* Accept an array OR a newline/comma-separated string of fingerprints, clean
   them to the canonical uppercase colon-hex form, and drop anything invalid. */
export function normalizeFingerprints(v) {
  let arr = [];
  if (Array.isArray(v)) arr = v;
  else if (typeof v === "string") arr = v.split(/[\n,]+/);
  return arr
    .map((s) => String(s || "").trim().toUpperCase())
    // valid SHA-256 = 32 bytes = 32 colon-separated 2-hex groups (95 chars)
    .filter((s) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(s));
}

/* Render the Digital Asset Links JSON (an array with one statement per app).
   If the config is disabled or has no fingerprints, returns an empty array so
   the endpoint is always valid JSON (bots/verifiers won't error). */
export function renderAssetLinks() {
  const cfg = getTwaConfig();
  if (!cfg.enabled || !cfg.sha256_fingerprints.length) return [];
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: cfg.package_name,
        sha256_cert_fingerprints: cfg.sha256_fingerprints,
      },
    },
  ];
}
