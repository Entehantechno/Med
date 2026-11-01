/* secret-store.js — encryption at rest and masking for provider API keys (R70).

   Problem (R70 audit): AI provider keys were stored as plain JSON in the
   `settings` table (`ai`, `vpatient_ai`, `blog_image_ai`, and `routes[].apiKey`
   inside `ai`), and the admin GET endpoints returned them in full. A leaked DB
   file, backup or admin screen therefore exposed a paid, billable secret.

   Fix:
   • sealSecret / openSecret — AES-256-GCM with a key derived from
     SETTINGS_ENCRYPTION_KEY (preferred) or from JWT_SECRET via HKDF.
     Sealed values look like "enc:v1:<iv>.<tag>.<ciphertext>". Legacy plain
     values still open (backwards compatible) and are sealed on the next write
     or by migrateLegacySecrets() at boot.
   • maskSecret — API responses only ever show "••••abcd" (last 4 characters).
   • isMaskedSecret — a masked value sent back by the admin UI means "keep the
     stored key" and must never overwrite it. */
import crypto from "crypto";

export const SEALED_PREFIX = "enc:v1:";
export const MASK_PREFIX = "••••";
/** Settings keys whose JSON value may carry apiKey fields. */
export const SECRET_BEARING_SETTINGS = ["ai", "vpatient_ai", "blog_image_ai"];

let cachedKey = null;
let cachedKeySource = "";
let warnedMissing = false;

function deriveKey() {
  const explicit = String(process.env.SETTINGS_ENCRYPTION_KEY || "").trim();
  if (explicit) {
    // Accept 64 hex chars, 43–44 base64 chars, or any passphrase (hashed).
    if (/^[0-9a-f]{64}$/i.test(explicit)) return { key: Buffer.from(explicit, "hex"), source: "env" };
    const b64 = Buffer.from(explicit, "base64");
    if (b64.length === 32 && /^[A-Za-z0-9+/=_-]+$/.test(explicit)) return { key: b64, source: "env" };
    return { key: crypto.createHash("sha256").update(explicit).digest(), source: "env" };
  }
  const base = String(process.env.JWT_SECRET || "").trim();
  if (!base) return null;
  const derived = crypto.hkdfSync("sha256", Buffer.from(base, "utf8"), Buffer.from("medlab"), Buffer.from("settings-apikey-v1"), 32);
  return { key: Buffer.from(derived), source: "jwt" };
}

function encKey() {
  // Re-derive when the env changes (tests and operators may rotate it).
  const source = `${process.env.SETTINGS_ENCRYPTION_KEY || ""}|${process.env.JWT_SECRET || ""}`;
  if (cachedKey && cachedKeySource === source) return cachedKey;
  cachedKey = deriveKey();
  cachedKeySource = source;
  return cachedKey;
}

/** True when sealing is possible (a key source exists). */
export function sealingAvailable() { return !!encKey(); }

export function sealSecret(plain) {
  const v = String(plain ?? "");
  if (!v) return "";
  if (v.startsWith(SEALED_PREFIX)) return v;          // already sealed
  if (v.startsWith(MASK_PREFIX)) return v;            // never persist a mask
  const k = encKey();
  if (!k) {
    if (!warnedMissing) { warnedMissing = true; console.warn("[secret-store] no JWT_SECRET/SETTINGS_ENCRYPTION_KEY — API keys stored unencrypted"); }
    return v;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", k.key, iv);
  const ct = Buffer.concat([cipher.update(v, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return SEALED_PREFIX + [iv, tag, ct].map((b) => b.toString("base64url")).join(".");
}

let warnedOpen = false;
export function openSecret(value) {
  const v = String(value ?? "");
  if (!v) return "";
  if (!v.startsWith(SEALED_PREFIX)) return v;          // legacy plaintext
  const k = encKey();
  try {
    const [iv, tag, ct] = v.slice(SEALED_PREFIX.length).split(".").map((x) => Buffer.from(x, "base64url"));
    const d = crypto.createDecipheriv("aes-256-gcm", k.key, iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
  } catch {
    // Wrong or rotated key: behave as "no key" instead of crashing the request.
    if (!warnedOpen) { warnedOpen = true; console.error("[secret-store] cannot decrypt a stored API key — check SETTINGS_ENCRYPTION_KEY / JWT_SECRET"); }
    return "";
  }
}

export function maskSecret(value) {
  const v = String(value ?? "");
  if (!v) return "";
  return MASK_PREFIX + (v.length >= 8 ? v.slice(-4) : "");
}

export function isMaskedSecret(value) {
  return typeof value === "string" && value.startsWith(MASK_PREFIX);
}

/* Walk a settings object and transform every `apiKey` string. */
function mapApiKeys(node, fn) {
  if (Array.isArray(node)) return node.map((x) => mapApiKeys(x, fn));
  if (node && typeof node === "object") {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      out[k] = (k === "apiKey" && typeof v === "string") ? fn(v) : mapApiKeys(v, fn);
    }
    return out;
  }
  return node;
}
export const sealConfigSecrets = (obj) => mapApiKeys(obj, sealSecret);
export const openConfigSecrets = (obj) => mapApiKeys(obj, openSecret);
export const maskConfigSecrets = (obj) => mapApiKeys(obj, (v) => maskSecret(openSecret(v)));

/* Parse a stored settings JSON string into internal (decrypted) form. */
export function parseStoredSettings(raw, fallback) {
  if (raw == null) return fallback;
  try { return openConfigSecrets(JSON.parse(raw)); } catch { return fallback; }
}

/* Serialise an internal settings object for storage (sealed). */
export function serializeSettings(obj) {
  return JSON.stringify(sealConfigSecrets(obj));
}

/* Admin listing: mask apiKey fields in any stored settings JSON. */
export function maskStoredSettingValue(raw) {
  if (typeof raw !== "string" || !raw.includes('"apiKey"')) return raw;
  try { return JSON.stringify(maskConfigSecrets(JSON.parse(raw))); } catch { return raw; }
}

/* Boot-time: seal any legacy plaintext apiKey left in the settings table. */
export function migrateLegacySecrets(db) {
  if (!sealingAvailable()) return { migrated: 0, skipped: "no_key" };
  let migrated = 0;
  const select = db.prepare("SELECT key, value FROM settings WHERE key=?");
  const update = db.prepare("UPDATE settings SET value=? WHERE key=?");
  const keys = [...SECRET_BEARING_SETTINGS];
  for (const key of keys) {
    const row = select.get(key);
    if (!row || !row.value || !row.value.includes('"apiKey"')) continue;
    let obj; try { obj = JSON.parse(row.value); } catch { continue; }
    const before = JSON.stringify(obj);
    const sealed = JSON.stringify(sealConfigSecrets(obj));
    if (sealed !== before) { update.run(sealed, key); migrated++; }
  }
  return { migrated };
}

/* Test helper: forget the cached key so env changes take effect. */
export function _resetSecretStoreForTests() { cachedKey = null; cachedKeySource = ""; warnedMissing = false; }

/* When the admin UI sends back a masked or empty apiKey, keep the stored one.
   Matches the top-level apiKey and routes[] entries by id. */
export function preserveMaskedKeys(next, prev) {
  const out = { ...(next || {}) };
  const keep = (incoming, stored) => {
    if (out.clearApiKey) return "";
    const v = String(incoming ?? "").trim();
    if (!v || isMaskedSecret(v)) return String(stored ?? "");
    return v;
  };
  out.apiKey = keep(next?.apiKey, prev?.apiKey);
  if (Array.isArray(next?.routes)) {
    out.routes = next.routes.map((r) => {
      const old = Array.isArray(prev?.routes) ? prev.routes.find((x) => x && r && x.id === r.id) : null;
      if (!r || typeof r !== "object") return r;
      const clear = !!r.clearApiKey;
      const v = String(r.apiKey ?? "").trim();
      const apiKey = clear ? "" : (!v || isMaskedSecret(v) ? String(old?.apiKey ?? "") : v);
      return { ...r, apiKey };
    });
  }
  return out;
}

/* Audit-safe copy of a settings value: never log apiKey material. */
export function redactForAudit(value) {
  try {
    const obj = typeof value === "string" ? JSON.parse(value) : value;
    if (obj && typeof obj === "object") return { redacted: true, keys: Object.keys(obj).slice(0, 20) };
  } catch { /* not JSON */ }
  return { redacted: true };
}
