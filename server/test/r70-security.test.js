// Round 70 — security hardening. One block per protection from the R70 audit.
// Each test is written to FAIL on the pre-R70 code (plain key returned by GET,
// reset links missing, impersonation tokens without `imp`, etc.).
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { execSync } from "child_process";
import crypto from "crypto";
import request from "supertest";
import jwt from "jsonwebtoken";
import express from "express";
import { initDb, db } from "../src/db.js";
import { createApp } from "../src/app.js";
import adminRoutes from "../src/routes/admin.js";
import { hashPassword } from "../src/lib/password.js";
import { bumpTokenVer, signToken } from "../src/lib/auth.js";
import { getSetting } from "../src/routes/content.js";
import { errorHandler } from "../src/lib/security.js";
import { listAudit } from "../src/lib/audit.js";
import {
  sealSecret, openSecret, maskSecret, isMaskedSecret, migrateLegacySecrets,
  sealConfigSecrets, maskConfigSecrets, preserveMaskedKeys, SEALED_PREFIX,
} from "../src/lib/secret-store.js";
import { checkEnvironment, forceHttpsEnabled, suspiciousIps } from "../src/lib/hardening.js";
import { renderMarkdown } from "../src/lib/blog.js";
import { sendVerificationEmail } from "../src/lib/mailer.js";
import { mockAllowed } from "../src/lib/zarinpal.js";

// Capture the password-reset token instead of sending e-mail.
const mailbox = { resetTokens: [] };
vi.mock("../src/lib/mailer.js", async (importOriginal) => {
  const orig = await importOriginal();
  return {
    ...orig,
    sendPasswordResetEmail: vi.fn(async (to, token) => {
      globalThis.__r70Mailbox.resetTokens.push({ to, token });
      return { sent: true };
    }),
  };
});
globalThis.__r70Mailbox = mailbox;

const sha256 = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
let app;
let admin;      // token
let teacher;    // token
const withEnv = async (patch, fn) => {
  const saved = {};
  for (const k of Object.keys(patch)) { saved[k] = process.env[k]; if (patch[k] === undefined) delete process.env[k]; else process.env[k] = patch[k]; }
  try { return await fn(); }
  finally { for (const k of Object.keys(saved)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } }
};
const login = (username, password = "demo") =>
  request(app).post("/api/auth/login").send({ username, password });
const bearer = (t) => ({ Authorization: `Bearer ${t}` });

async function makeLearner(username, password = "Old-Password-2026") {
  const hash = await hashPassword(password);
  db.prepare("DELETE FROM users WHERE username=?").run(username);
  const info = db.prepare("INSERT INTO users (username,email,password_hash,name_fa,name_en,role,status,email_verified) VALUES (?,?,?,?,?,'learner','active',1)")
    .run(username, username, hash, "تست", "Test");
  return Number(info.lastInsertRowid);
}

beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb();
  app = createApp();
  admin = (await login("admin")).body.token;
  teacher = (await login("teacher")).body.token;
});

afterAll(() => {
  db.prepare("DELETE FROM settings WHERE key IN ('ai','vpatient_ai','blog_image_ai')").run();
});

/* ------------------------------------------------------------------ */
describe("R70 · API keys hidden and encrypted at rest", () => {
  it("seal/open round-trip; the stored form hides the plaintext", () => {
    const s = sealSecret("sk-live-ABCDEFGH-1234");
    expect(s.startsWith(SEALED_PREFIX)).toBe(true);
    expect(s).not.toContain("ABCDEFGH");
    expect(openSecret(s)).toBe("sk-live-ABCDEFGH-1234");
  });

  it("tampered ciphertext is rejected (GCM authentication) and reads as empty", () => {
    const s = sealSecret("sk-tamper-me-0000");
    const bad = s.slice(0, -4) + (s.endsWith("AAAA") ? "BBBB" : "AAAA");
    expect(openSecret(bad)).toBe("");
  });

  it("legacy plaintext still opens, so an upgrade does not break a live key", () => {
    expect(openSecret("legacy-plain-key")).toBe("legacy-plain-key");
  });

  it("masking shows only the last four characters and is recognised on the way back", () => {
    expect(maskSecret("sk-abcdef123456")).toBe("••••3456");
    expect(maskSecret("")).toBe("");
    expect(isMaskedSecret(maskSecret("sk-abcdef123456"))).toBe(true);
    expect(isMaskedSecret("sk-real-key")).toBe(false);
  });

  it("a masked value sent back by the admin UI keeps the stored key", () => {
    const prev = { apiKey: "sk-stored-KEEP-9999", routes: [{ id: "a", apiKey: "sk-route-KEEP-1111" }] };
    const next = { apiKey: "••••9999", routes: [{ id: "a", apiKey: "••••1111", enabled: true }] };
    const out = preserveMaskedKeys(next, prev);
    expect(out.apiKey).toBe("sk-stored-KEEP-9999");
    expect(out.routes[0].apiKey).toBe("sk-route-KEEP-1111");
    expect(preserveMaskedKeys({ apiKey: "", clearApiKey: true }, prev).apiKey).toBe("");
  });

  it("PUT /api/settings/ai stores the key sealed; GET returns only the mask", async () => {
    const secret = "sk-or-REALKEY-ZZZZ-1234";
    const put = await request(app).put("/api/settings/ai").set(bearer(admin))
      .send({ provider: "OpenAI", model: "gpt-4o-mini", apiKey: secret, routingEnabled: false });
    expect(put.status).toBe(200);
    const raw = db.prepare("SELECT value FROM settings WHERE key='ai'").get().value;
    expect(raw).not.toContain("REALKEY");
    expect(raw).toContain(SEALED_PREFIX);
    const get = await request(app).get("/api/settings/ai").set(bearer(admin));
    expect(JSON.stringify(get.body)).not.toContain("REALKEY");
    expect(get.body.apiKey).toBe("••••1234");
    // the server itself still has the real key for live calls
    expect(getSetting("ai", {}).apiKey).toBe(secret);
  });

  it("GET /api/admin/settings never lists a raw provider key", async () => {
    const res = await request(app).get("/api/admin/settings").set(bearer(admin));
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain("REALKEY");
  });

  it("the revived admin VP-patient AI endpoints (admin-only, R72) work and never echo a key", async () => {
    // Admin VP config is open to admins (R72 revival). Masking is still required.
    const put = await request(app).put("/api/admin/vpatient/ai").set(bearer(admin))
      .send({ provider: "OpenAI", model: "gpt-4o-mini", apiKey: "sk-vp-SECRET-7777" });
    expect(put.status).toBe(200);
    expect(JSON.stringify(put.body)).not.toContain("SECRET-7777");
    const get = await request(app).get("/api/admin/vpatient/ai").set(bearer(admin));
    expect(get.status).toBe(200);
    expect(JSON.stringify(get.body)).not.toContain("SECRET-7777");
  });

  it("generic admin settings write seals a provider key and audit never logs it", async () => {
    const res = await request(app).put("/api/admin/settings/blog_image_ai").set(bearer(admin))
      .send({ value: JSON.stringify({ provider: "openai", apiKey: "sk-img-AUDITME-5555" }) });
    expect(res.status).toBe(200);
    const raw = db.prepare("SELECT value FROM settings WHERE key='blog_image_ai'").get().value;
    expect(raw).not.toContain("AUDITME");
    const audit = listAudit({ limit: 50, action: "settings.change" });
    expect(JSON.stringify(audit)).not.toContain("AUDITME");
  });

  it("generic admin settings write refuses a key-bearing value that is not valid JSON", async () => {
    const res = await request(app).put("/api/admin/settings/ai").set(bearer(admin))
      .send({ value: "not-json sk-oops" });
    expect(res.status).toBe(400);
  });

  it("legacy plaintext keys are sealed by the boot migration (idempotent)", () => {
    db.prepare("INSERT INTO settings (key,value) VALUES ('blog_image_ai', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
      .run(JSON.stringify({ provider: "openrouter", apiKey: "legacy-KEY-0042" }));
    expect(migrateLegacySecrets(db).migrated).toBeGreaterThanOrEqual(1);
    const raw = db.prepare("SELECT value FROM settings WHERE key='blog_image_ai'").get().value;
    expect(raw).not.toContain("legacy-KEY-0042");
    expect(getSetting("blog_image_ai", {}).apiKey).toBe("legacy-KEY-0042");
    expect(migrateLegacySecrets(db).migrated).toBe(0);
  });

  it("maskConfigSecrets walks nested routes", () => {
    const m = maskConfigSecrets({ routes: [{ id: "x", apiKey: "sk-nested-1234" }] });
    expect(m.routes[0].apiKey).toBe("••••1234");
    expect(sealConfigSecrets({ routes: [{ apiKey: "k-1" }] }).routes[0].apiKey.startsWith(SEALED_PREFIX)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
describe("R70 · HTTPS, cookies, headers, CORS", () => {
  it("forceHttpsEnabled: on in production, off with FORCE_HTTPS=0, on with FORCE_HTTPS=1", () => {
    expect(forceHttpsEnabled({ NODE_ENV: "production" })).toBe(true);
    expect(forceHttpsEnabled({ NODE_ENV: "production", FORCE_HTTPS: "0" })).toBe(false);
    expect(forceHttpsEnabled({ NODE_ENV: "test", FORCE_HTTPS: "1" })).toBe(true);
    expect(forceHttpsEnabled({ NODE_ENV: "test" })).toBe(false);
  });

  it("plain-HTTP page requests are redirected to HTTPS; health check stays reachable", async () => {
    await withEnv({ FORCE_HTTPS: "1", APP_URL: "https://medschool.ir" }, async () => {
      const page = await request(app).get("/some/page").set("Host", "medschool.ir");
      expect(page.status).toBe(308);
      expect(page.headers.location).toBe("https://medschool.ir/some/page");
      const health = await request(app).get("/api/health").set("Host", "medschool.ir");
      expect(health.status).toBe(200);
    });
  });

  it("a forged Host header cannot redirect users elsewhere (APP_URL wins)", async () => {
    await withEnv({ FORCE_HTTPS: "1", APP_URL: "https://medschool.ir" }, async () => {
      const res = await request(app).get("/x").set("Host", "evil.example");
      expect(res.status).toBe(308);
      expect(res.headers.location.startsWith("https://medschool.ir/")).toBe(true);
    });
  });

  it("behind an HTTPS proxy (X-Forwarded-Proto: https) the request is served, not redirected", async () => {
    await withEnv({ FORCE_HTTPS: "1" }, async () => {
      const res = await request(app).get("/api/health").set("X-Forwarded-Proto", "https");
      expect(res.status).toBe(200);
    });
  });

  it("login cookie is HttpOnly, SameSite=Lax and Secure when HTTPS is enforced", async () => {
    await withEnv({ FORCE_HTTPS: "1" }, async () => {
      const res = await request(app).post("/api/auth/login").set("X-Forwarded-Proto", "https")
        .send({ username: "learner", password: "demo" });
      const cookie = (res.headers["set-cookie"] || []).find((c) => c.startsWith("medlab_token="));
      expect(cookie).toBeTruthy();
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      expect(cookie).toMatch(/Secure/i);
    });
  });

  it("security headers: nosniff, framing, CSP without inline scripts, referrer policy, no X-Powered-By", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(String(res.headers["x-frame-options"] || res.headers["content-security-policy"] || "")).toMatch(/DENY|SAMEORIGIN|frame-ancestors/i);
    expect(res.headers["referrer-policy"]).toBeTruthy();
    expect(res.headers["x-powered-by"]).toBeUndefined();
    const csp = String(res.headers["content-security-policy"] || res.headers["content-security-policy-report-only"] || "");
    expect(csp).toMatch(/script-src[^;]*'self'/);
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(csp).toMatch(/object-src 'none'/);
  });

  it("CORS: a foreign origin gets no Access-Control-Allow-Origin header", async () => {
    const res = await request(app).get("/api/health").set("Origin", "https://evil.example");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("environment audit flags CORS '*' and the production foot-guns", () => {
    const bad = checkEnvironment({
      NODE_ENV: "production", JWT_SECRET: "x".repeat(40), APP_URL: "http://insecure.example",
      DISABLE_RATE_LIMIT: "1", ALLOW_MOCK_PAY: "1", CORS_ORIGIN: "*",
    });
    const keys = bad.filter((f) => f.level === "error").map((f) => f.key);
    expect(keys).toEqual(expect.arrayContaining(["APP_URL", "DISABLE_RATE_LIMIT", "ALLOW_MOCK_PAY", "CORS_ORIGIN"]));
  });

  it("environment audit is clean for a correctly configured production host", () => {
    const good = checkEnvironment({
      NODE_ENV: "production", JWT_SECRET: crypto.randomBytes(32).toString("hex"), APP_URL: "https://medschool.ir",
      SETTINGS_ENCRYPTION_KEY: "k".repeat(20), ZARINPAL_MERCHANT_ID: "m", SMTP_HOST: "smtp.example", ADMIN_IP_ALLOWLIST: "203.0.113.5",
    });
    expect(good.filter((f) => f.level === "error")).toEqual([]);
  });

  it("environment audit rejects a short JWT_SECRET in production", () => {
    const bad = checkEnvironment({ NODE_ENV: "production", JWT_SECRET: "short", APP_URL: "https://x.ir" });
    expect(bad.some((f) => f.key === "JWT_SECRET" && f.level === "error")).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
describe("R70 · CSRF", () => {
  it("a cookie-only write from a cross-site context is refused (Fetch Metadata)", async () => {
    const res = await request(app).post("/api/auth/logout")
      .set("Sec-Fetch-Site", "cross-site").set("Cookie", `medlab_token=${admin}`).send({});
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("bad_origin");
  });

  it("a same-site request from a sibling subdomain is refused for cookie auth too", async () => {
    const res = await request(app).post("/api/auth/logout")
      .set("Sec-Fetch-Site", "same-site").set("Cookie", `medlab_token=${admin}`).send({});
    expect(res.status).toBe(403);
  });

  it("the same write with a Bearer token is not blocked by the cookie rule", async () => {
    // A throw-away session: /logout revokes the presented token, and the shared admin token must survive.
    const own = (await login("learner")).body.token;
    const res = await request(app).post("/api/auth/logout")
      .set("Sec-Fetch-Site", "cross-site").set("Authorization", `Bearer ${own}`).send({});
    expect(res.status).not.toBe(403);
  });
});

/* ------------------------------------------------------------------ */
describe("R70 · admin routes are locked", () => {
  it("every admin route refuses anonymous requests", async () => {
    const routes = adminRoutes.stack.filter((l) => l.route).flatMap((l) =>
      Object.keys(l.route.methods).filter((m) => ["get", "post", "put", "patch", "delete"].includes(m))
        .map((m) => ({ method: m, path: l.route.path })));
    expect(routes.length).toBeGreaterThan(150);
    const leaks = [];
    for (const { method, path } of routes) {
      const url = "/api/admin" + String(path).replace(/:[A-Za-z_]+/g, "1");
      const res = await request(app)[method](url).send({});
      if (![401, 403].includes(res.status)) leaks.push(`${method.toUpperCase()} ${url} -> ${res.status}`);
    }
    expect(leaks).toEqual([]);
  });

  it("ADMIN_IP_ALLOWLIST blocks admin routes from other addresses and allows listed ones", async () => {
    await withEnv({ ADMIN_IP_ALLOWLIST: "203.0.113.9" }, async () => {
      const blocked = await request(app).get("/api/admin/settings").set(bearer(admin));
      expect(blocked.status).toBe(403);
      expect(blocked.body.error).toBe("admin_ip_not_allowed");
    });
    await withEnv({ ADMIN_IP_ALLOWLIST: "127.0.0.1,::1" }, async () => {
      const ok = await request(app).get("/api/admin/settings").set(bearer(admin));
      expect(ok.status).toBe(200);
    });
  });

  it("a learner token cannot reach admin data", async () => {
    const learner = (await login("learner")).body.token;
    const res = await request(app).get("/api/admin/settings").set(bearer(learner));
    expect([401, 403]).toContain(res.status);
  });
});

/* ------------------------------------------------------------------ */
describe("R70 · password reset links", () => {
  const EMAIL = "r70reset@example.com";
  beforeAll(async () => { await makeLearner(EMAIL, "Old-Password-2026"); });

  it("forgot-password answers the same way for known and unknown accounts (no enumeration)", async () => {
    const known = await request(app).post("/api/auth/forgot").send({ email: EMAIL });
    const unknown = await request(app).post("/api/auth/forgot").send({ email: "nobody-r70@example.com" });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
  });

  it("the reset token is random, mailed, and only its hash is stored", () => {
    const sent = mailbox.resetTokens.filter((m) => m.to === EMAIL).pop();
    expect(sent).toBeTruthy();
    expect(sent.token.length).toBeGreaterThanOrEqual(40);
    const row = db.prepare("SELECT * FROM password_resets WHERE user_id=(SELECT id FROM users WHERE username=?) AND used_at IS NULL ORDER BY id DESC LIMIT 1").get(EMAIL);
    expect(row.token_hash).toBe(sha256(sent.token));
    expect(row.token_hash).not.toBe(sent.token);
    expect(db.prepare("SELECT 1 FROM password_resets WHERE token_hash=?").get(sent.token)).toBeUndefined();
  });

  it("a link expires after 30 minutes", async () => {
    await request(app).post("/api/auth/forgot").send({ email: EMAIL });
    const fresh = mailbox.resetTokens.filter((m) => m.to === EMAIL).pop();
    db.prepare("UPDATE password_resets SET expires_at=datetime('now','-1 minute') WHERE token_hash=?").run(sha256(fresh.token));
    const res = await request(app).post("/api/auth/reset").send({ token: fresh.token, password: "Expired-Try-2026" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_or_expired_token");
  });

  it("a successful reset works once, signs out old sessions, and changes the password", async () => {
    const oldSession = (await login(EMAIL, "Old-Password-2026")).body.token;
    expect(oldSession).toBeTruthy();
    await request(app).post("/api/auth/forgot").send({ email: EMAIL });
    const link = mailbox.resetTokens.filter((m) => m.to === EMAIL).pop();
    const ok = await request(app).post("/api/auth/reset").send({ token: link.token, password: "Brand-New-2026" });
    expect(ok.status).toBe(200);
    const reuse = await request(app).post("/api/auth/reset").send({ token: link.token, password: "Another-2026" });
    expect(reuse.status).toBe(400);
    expect((await login(EMAIL, "Brand-New-2026")).status).toBe(200);
    expect((await login(EMAIL, "Old-Password-2026")).status).toBe(401);
    expect((await request(app).get("/api/auth/me").set(bearer(oldSession))).status).toBe(401);
  });

  it("weak or breached passwords are refused on reset", async () => {
    await request(app).post("/api/auth/forgot").send({ email: EMAIL });
    const link = mailbox.resetTokens.filter((m) => m.to === EMAIL).pop();
    const weak = await request(app).post("/api/auth/reset").send({ token: link.token, password: "password" });
    expect(weak.status).toBe(400);
    // the weak attempt must not consume the link
    const still = await request(app).post("/api/auth/reset").send({ token: link.token, password: "Works-Now-2026" });
    expect(still.status).toBe(200);
  });

  it("a garbage token is refused", async () => {
    const res = await request(app).post("/api/auth/reset").send({ token: "nope", password: "Something-2026" });
    expect(res.status).toBe(400);
  });

  it("requesting resets is rate-limited on every call", async () => {
    await withEnv({ DISABLE_RATE_LIMIT: "" }, async () => {
      const email = "flood-r70@example.com";
      const codes = [];
      for (let i = 0; i < 7; i++) codes.push((await request(app).post("/api/auth/forgot").send({ email })).status);
      expect(codes.slice(0, 5).every((c) => c === 200)).toBe(true);
      expect(codes[6]).toBe(429);
    });
  });

  it("a verification link older than 48 hours no longer works", async () => {
    const uid = await makeLearner("verify-r70@example.com");
    const raw = crypto.randomBytes(24).toString("hex");
    db.prepare("INSERT INTO email_verifications (token, user_id, email, created_at) VALUES (?,?,?, datetime('now','-3 days'))").run(sha256(raw), uid, "verify-r70@example.com");
    const res = await request(app).get(`/api/auth/verify?token=${raw}`);
    expect(res.status).toBe(400);
    const raw2 = crypto.randomBytes(24).toString("hex");
    db.prepare("INSERT INTO email_verifications (token, user_id, email) VALUES (?,?,?)").run(sha256(raw2), uid, "verify-r70@example.com");
    const fresh = await request(app).get(`/api/auth/verify?token=${raw2}`);
    expect(fresh.status).toBe(302);
  });

  it("verification e-mail never prints the token in production logs", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      await sendVerificationEmail("nobody@example.com", "SECRET-TOKEN-PRINT-CHECK");
      const printed = spy.mock.calls.map((c) => c.join(" ")).join("\n");
      expect(printed).not.toContain("SECRET-TOKEN-PRINT-CHECK");
    } finally {
      process.env.NODE_ENV = prevEnv;
      spy.mockRestore();
    }
  });
});

/* ------------------------------------------------------------------ */
describe("R70 · impersonation is short-lived and attributable", () => {
  it("the impersonation token expires in 30 minutes, names the admin, and follows password changes", async () => {
    const uid = await makeLearner("impersonate-r70@example.com");
    const res = await request(app).post(`/api/admin/users/${uid}/impersonate`).set(bearer(admin)).send({});
    expect(res.status).toBe(200);
    const payload = jwt.decode(res.body.token);
    expect(payload.exp - payload.iat).toBe(1800);
    expect(payload.imp).toBe(Number(jwt.decode(admin).id));
    const me = await request(app).get("/api/auth/me").set(bearer(res.body.token));
    expect(me.status).toBe(200);
    expect(me.body.user?.id ?? me.body.id).toBe(uid);
    bumpTokenVer(uid); // a password change / sign-out-everywhere must end it
    expect((await request(app).get("/api/auth/me").set(bearer(res.body.token))).status).toBe(401);
  });

  it("plain tokens are still 12 hours and carry no impersonation claim", () => {
    const t = signToken({ id: 1, role: "learner", username: "x", token_ver: 1 });
    const p = jwt.decode(t);
    expect(p.exp - p.iat).toBe(12 * 3600);
    expect(p.imp).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
describe("R70 · impersonation sessions cannot change credentials", () => {
  it("an impersonation token is refused on password change, profile edit and logout-all", async () => {
    const admin = (await login("admin")).body.token;
    const target = db.prepare("SELECT id FROM users WHERE username='learner'").get();
    const imp = (await request(app).post(`/api/admin/users/${target.id}/impersonate`).set(bearer(admin)).send({})).body.token;
    expect(imp).toBeTruthy();
    const pw = await request(app).put("/api/auth/password").set(bearer(imp)).send({ current: "demo", next: "Another-Strong-Pass-7" });
    expect(pw.status).toBe(403);
    expect(pw.body.error).toBe("impersonation_forbidden");
    const me = await request(app).put("/api/auth/me").set(bearer(imp)).send({ bio: "x" });
    expect(me.status).toBe(403);
    const all = await request(app).post("/api/auth/logout-all").set(bearer(imp)).send({});
    expect(all.status).toBe(403);
    // reading the profile still works, so the support view is useful
    const read = await request(app).get("/api/auth/me").set(bearer(imp));
    expect(read.status).toBe(200);
  });
});

describe("R70 · uploads", () => {
  it("a file with a .jpg name but non-image content is refused", async () => {
    const res = await request(app).post("/api/upload/").set(bearer(teacher))
      .attach("file", Buffer.from("<script>alert(1)</script>"), { filename: "evil.jpg", contentType: "image/jpeg" });
    expect(res.status).toBe(400);
  });

  it("an executable extension is refused even with an image MIME", async () => {
    const res = await request(app).post("/api/upload/").set(bearer(teacher))
      .attach("file", Buffer.from("MZ....."), { filename: "tool.exe", contentType: "image/png" });
    expect(res.status).toBe(400);
  });

  it("uploads require a teacher or admin", async () => {
    const learner = (await login("learner")).body.token;
    const res = await request(app).post("/api/upload/").set(bearer(learner))
      .attach("file", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), { filename: "a.png", contentType: "image/png" });
    expect([401, 403]).toContain(res.status);
  });
});

/* ------------------------------------------------------------------ */
describe("R70 · injection, XSS, validation", () => {
  it("SQL-injection style username does not log in", async () => {
    const res = await login("' OR '1'='1", "demo");
    expect(res.status).not.toBe(200);
  });

  it("an object where a string is expected is rejected (no NoSQL-style operator injection)", async () => {
    const res = await request(app).post("/api/auth/login").send({ username: { $ne: "" }, password: "demo" });
    expect(res.status).not.toBe(200);
  });

  it("blog markdown: script tags, javascript: links and attribute breakouts are neutralised", () => {
    const html = renderMarkdown([
      "<script>alert(1)</script>",
      "[click](javascript:alert(1))",
      "![x\" onerror=\"alert(1)](x.png)",
      "<img src=x onerror=alert(1)>",
    ].join("\n\n"));
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/javascript:/i);
    // Every real tag is checked with quoted values removed: no event-handler attribute may remain.
    const tags = html.match(/<[a-z][^>]*>/gi) || [];
    for (const tag of tags) expect(tag.replace(/"[^"]*"|'[^']*'/g, "")).not.toMatch(/\son[a-z]+\s*=/i);
    expect(html).toContain("&lt;script&gt;");
  });

  it("production error handler does not leak internal details for 5xx", async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const probe = express();
      probe.get("/boom", () => { throw new Error("SQLITE path /var/lib/secret.db failed"); });
      probe.use(errorHandler);
      const res = await request(probe).get("/boom");
      expect(res.status).toBe(500);
      expect(JSON.stringify(res.body)).not.toContain("secret.db");
    } finally { process.env.NODE_ENV = prev; }
  });

  it("no debug route is exposed under /api", async () => {
    for (const p of ["/api/debug", "/api/__debug", "/api/env", "/api/_internal"]) {
      const res = await request(app).get(p);
      expect(res.status).toBe(404);
    }
  });
});

/* ------------------------------------------------------------------ */
describe("R70 · payments are priced on the server", () => {
  it("the amount charged comes from the catalogue, not from the request body", async () => {
    const learner = (await login("learner")).body.token;
    const plans = await request(app).get("/api/pay/plans").set(bearer(learner));
    const catalogue = plans.body.plans.monthly;
    const res = await request(app).post("/api/pay/subscribe").set(bearer(learner))
      .send({ plan: "monthly", amount: 1 });
    expect(res.status).toBe(200);
    const row = db.prepare("SELECT amount FROM transactions WHERE authority=?").get(res.body.authority);
    expect(row.amount).toBe(catalogue);
    expect(row.amount).not.toBe(1);
  });

  it("a forged callback for an unknown authority grants nothing", async () => {
    const res = await request(app).get("/api/pay/callback?Authority=FORGED-R70&Status=OK");
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("pay=notfound");
  });

  it("the offline mock gateway is refused in production", () => {
    const prev = process.env.NODE_ENV;
    const prevAllow = process.env.ALLOW_MOCK_PAY;
    process.env.NODE_ENV = "production";
    delete process.env.ALLOW_MOCK_PAY;
    try { expect(mockAllowed()).toBe(false); }
    finally { process.env.NODE_ENV = prev; if (prevAllow !== undefined) process.env.ALLOW_MOCK_PAY = prevAllow; }
  });
});

/* ------------------------------------------------------------------ */
describe("R70 · suspicious activity is recorded and surfaced", () => {
  it("many failed attempts from one address are flagged", () => {
    const ip = "198.51.100.77";
    db.prepare("DELETE FROM security_events WHERE ip=?").run(ip);
    for (let i = 0; i < 30; i++) {
      db.prepare("INSERT INTO security_events (kind,status,method,path,ip) VALUES ('unauthorized',401,'POST','/api/auth/login',?)").run(ip);
    }
    const flagged = suspiciousIps(db, { windowMinutes: 60, threshold: 25 });
    expect(flagged.find((x) => x.ip === ip)?.failures).toBeGreaterThanOrEqual(30);
    db.prepare("DELETE FROM security_events WHERE ip=?").run(ip);
  });

  it("bad logins are written to the security log", async () => {
    const before = db.prepare("SELECT COUNT(*) n FROM security_events WHERE status=401").get().n;
    await login("admin", "wrong-password-r70");
    await new Promise((r) => setTimeout(r, 50)); // the event is written on response 'finish'
    const after = db.prepare("SELECT COUNT(*) n FROM security_events WHERE status=401").get().n;
    expect(after).toBeGreaterThan(before);
  });
});
