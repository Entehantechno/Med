/* google.js — verify a Google Sign-In ID token (GIS / One Tap credential).

   Production path (Google OpenID Connect + backend-auth docs, 2025–26):
     1. Fetch Google's JWKS (https://www.googleapis.com/oauth2/v3/certs), cache
        for ~6h (keys rotate infrequently; honour Cache-Control when present).
     2. Verify RS256 signature locally with crypto.createPublicKey({format:"jwk"}).
     3. Check iss ∈ {accounts.google.com, https://accounts.google.com},
        aud === our client id, exp, email_verified, and optional nonce.

   tokeninfo is a fallback only (network + not for hot path). Never trust the
   client-supplied profile without a verified JWT.

   Client ID: process.env.GOOGLE_CLIENT_ID or settings key google_client_id
   so cPanel operators can enable Google without editing .env. */
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { db } from "../db.js";
import { safeFetch } from "./security.js";

const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const TOKENINFO = "https://oauth2.googleapis.com/tokeninfo?id_token=";
const ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);
const CACHE_MS = 6 * 60 * 60 * 1000;

let jwksCache = { keys: null, exp: 0 };

export function setGoogleClientId(id) {
  const v = String(id || "").trim();
  db.prepare(
    "INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
  ).run("google_client_id", JSON.stringify(v));
  return v;
}

export function googleClientId() {
  const env = String(process.env.GOOGLE_CLIENT_ID || "").trim();
  if (env) return env;
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key='google_client_id'").get();
    if (!row) return "";
    const parsed = JSON.parse(row.value);
    if (typeof parsed === "string") return parsed.trim();
    return String(parsed?.client_id || parsed?.value || "").trim();
  } catch {
    return "";
  }
}

export function googleConfigured() { return !!googleClientId(); }

async function loadJwks() {
  if (jwksCache.keys && Date.now() < jwksCache.exp) return jwksCache.keys;
  const res = await safeFetch(JWKS_URL, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("jwks fetch failed");
  const body = await res.json();
  const keys = Array.isArray(body.keys) ? body.keys : [];
  if (!keys.length) throw new Error("empty jwks");
  let ttl = CACHE_MS;
  const cc = String(res.headers.get("cache-control") || "");
  const m = /max-age=(\d+)/i.exec(cc);
  if (m) ttl = Math.min(CACHE_MS, Math.max(60_000, Number(m[1]) * 1000));
  jwksCache = { keys, exp: Date.now() + ttl };
  return keys;
}

function publicKeyFromJwk(jwk) {
  return crypto.createPublicKey({ key: jwk, format: "jwk" });
}

export async function verifyWithJwks(credential, audience, nonce) {
  const header = jwt.decode(credential, { complete: true });
  if (!header?.header) throw new Error("not a jwt");
  if (header.header.alg !== "RS256") throw new Error("bad alg");
  const keys = await loadJwks();
  const kid = header.header.kid;
  const jwk = keys.find((k) => k.kid === kid) || keys.find((k) => k.kty === "RSA");
  if (!jwk) throw new Error("no matching jwk");
  const payload = jwt.verify(credential, publicKeyFromJwk(jwk), {
    algorithms: ["RS256"],
    audience,
    clockTolerance: 60,
  });
  if (!ISSUERS.has(String(payload.iss || ""))) throw new Error("bad iss");
  if (payload.aud !== audience) throw new Error("audience mismatch");
  if (!payload.exp || payload.exp * 1000 < Date.now() - 60_000) throw new Error("expired");
  if (payload.email_verified !== true && payload.email_verified !== "true") {
    throw new Error("email not verified by google");
  }
  if (nonce && payload.nonce && payload.nonce !== nonce) throw new Error("nonce mismatch");
  return payload;
}

async function verifyWithTokeninfo(credential, audience) {
  const res = await safeFetch(TOKENINFO + encodeURIComponent(credential));
  if (!res.ok) throw new Error("invalid google token");
  const p = await res.json();
  if (p.aud !== audience) throw new Error("audience mismatch");
  if (!ISSUERS.has(String(p.iss || ""))) throw new Error("bad iss");
  if (p.email_verified !== "true" && p.email_verified !== true) throw new Error("email not verified by google");
  return p;
}

function toProfile(p) {
  return {
    google_id: p.sub,
    email: String(p.email || "").toLowerCase(),
    name: p.name || p.email,
    given_name: p.given_name || "",
    picture: p.picture || "",
  };
}

export async function verifyGoogleToken(credential, { nonce } = {}) {
  const aud = googleClientId();
  if (!aud) throw new Error("google not configured");
  if (!credential) throw new Error("no credential");
  try {
    return toProfile(await verifyWithJwks(credential, aud, nonce));
  } catch {
    return toProfile(await verifyWithTokeninfo(credential, aud));
  }
}
