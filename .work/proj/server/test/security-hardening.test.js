import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { isSafeOutboundUrl, extractIpv4, jsonReviver, parseHibpRange, sha1Upper } from "../src/lib/security.js";
import { renderMarkdown } from "../src/lib/blog.js";
import { passwordRejected } from "../src/routes/auth.js";
import { initDb } from "../src/db.js";
import { createApp } from "../src/app.js";

let app;
beforeAll(async () => {
  await initDb();
  app = createApp();
});

describe("SSRF: encodings that used to slip past the hostname list", () => {
  it("still allows a public HTTPS provider", () => {
    expect(isSafeOutboundUrl("https://api.openai.com/v1").ok).toBe(true);
  });

  it("always blocks cloud metadata, including IPv4-mapped IPv6", () => {
    expect(isSafeOutboundUrl("http://169.254.169.254/latest/meta-data").ok).toBe(false);
    expect(isSafeOutboundUrl("http://[::ffff:169.254.169.254]/latest/meta-data").ok).toBe(false);
    expect(extractIpv4("::ffff:169.254.169.254")).toBe("169.254.169.254");
  });

  it("blocks file/ftp and integer-form loopback", () => {
    expect(isSafeOutboundUrl("file:///etc/passwd").ok).toBe(false);
    expect(isSafeOutboundUrl("ftp://example.com/x").ok).toBe(false);
    expect(extractIpv4("2130706433")).toBe("127.0.0.1");
  });

  it("decodes HackTricks IPFuscation (hex/octal/short/6to4)", () => {
    expect(extractIpv4("0x7f000001")).toBe("127.0.0.1");
    expect(extractIpv4("017700000001")).toBe("127.0.0.1");
    expect(extractIpv4("0x7f.0.0.1")).toBe("127.0.0.1");
    expect(extractIpv4("0177.0.0.1")).toBe("127.0.0.1");
    expect(extractIpv4("127.1")).toBe("127.0.0.1");
    expect(extractIpv4("2002:a9fe:a9fe::")).toBe("169.254.169.254");
    expect(extractIpv4("0")).toBe("0.0.0.0");
  });

  it("always blocks vendor IMDS aliases", () => {
    expect(isSafeOutboundUrl("http://169.254.170.2/v2/metadata").ok).toBe(false);
    expect(isSafeOutboundUrl("http://100.100.100.200/latest/meta-data").ok).toBe(false);
    expect(isSafeOutboundUrl("http://168.63.129.16/metadata/instance").ok).toBe(false);
  });

  it("blocks private ranges in production even via mapped IPv6", () => {
    const prev = process.env.NODE_ENV;
    const prevAllow = process.env.ALLOW_LOCAL_AI;
    process.env.NODE_ENV = "production";
    delete process.env.ALLOW_LOCAL_AI;
    expect(isSafeOutboundUrl("http://[::ffff:127.0.0.1]/").ok).toBe(false);
    expect(isSafeOutboundUrl("http://[::ffff:10.0.0.5]/").ok).toBe(false);
    expect(isSafeOutboundUrl("http://100.64.0.1/").ok).toBe(false);
    process.env.NODE_ENV = prev;
    if (prevAllow !== undefined) process.env.ALLOW_LOCAL_AI = prevAllow;
    else delete process.env.ALLOW_LOCAL_AI;
  });
});

describe("JSON prototype-pollution reviver", () => {
  it("drops __proto__ / constructor / prototype keys", () => {
    const raw = '{"ok":true,"__proto__":{"polluted":1},"constructor":{"name":"x"}}';
    const parsed = JSON.parse(raw, jsonReviver);
    expect(parsed.ok).toBe(true);
    expect(Object.prototype.polluted).toBeUndefined();
    expect(parsed.__proto__).toBe(Object.prototype);
  });
});

describe("HTTP hardening on a live app", () => {
  it("sets CSP / HSTS / frame deny and hides X-Powered-By", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.headers["content-security-policy"]).toMatch(/script-src-attr 'none'/);
    expect(res.headers["content-security-policy"]).toMatch(/accounts\.google\.com/);
    expect(res.headers["strict-transport-security"]).toBeTruthy();
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["permissions-policy"]).toMatch(/browsing-topics/);
  });

  it("rejects TRACE", async () => {
    const res = await request(app).trace("/api/health");
    expect(res.status).toBe(405);
  });

  it("rejects a poisoned Host header", async () => {
    const res = await request(app).get("/api/health").set("Host", "evil.com@127.0.0.1");
    expect(res.status).toBe(400);
  });

  it("does not let a __proto__ key pollute the parsed body", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send('{"username":"nobody","password":"x","__proto__":{"admin":true}}');
    expect(res.status).toBe(401);
    expect(Object.prototype.admin).toBeUndefined();
  });
});

describe("password policy + JWT revocation (OWASP ASVS 6.2 / 2026 session rules)", () => {
  it("rejects common and product-name passwords", () => {
    expect(passwordRejected("password123")).toBe("common");
    expect(passwordRejected("medschool")).toBe("common");
    expect(passwordRejected("decentPass9x")).toBe(null);
  });

  it("parses HIBP k-anonymity range bodies without sending the password", () => {
    const hash = sha1Upper("password");
    expect(hash).toHaveLength(40);
    const suffix = hash.slice(5);
    const body = `00000:1\r\n${suffix}:3342187\r\nFFFFF:2\r\n`;
    expect(parseHibpRange(body, suffix)).toBeGreaterThan(0);
    expect(parseHibpRange(body, "DEADBEEF")).toBe(0);
  });

  it("revokes the current JWT on logout (ASVS 3.3.1)", async () => {
    const email = `jti_${Date.now()}@test.com`;
    const reg = await request(app).post("/api/auth/register").send({ email, password: "firstPass9x", name_fa: "خروج" });
    expect(reg.status).toBe(200);
    const tok = reg.body.token;
    const ok = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${tok}`);
    expect(ok.status).toBe(200);
    const out = await request(app).post("/api/auth/logout").set("Authorization", `Bearer ${tok}`).send({});
    expect(out.status).toBe(200);
    const dead = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${tok}`);
    expect(dead.status).toBe(401);
  });

  it("logout-all bumps token_ver so every device dies", async () => {
    const email = `all_${Date.now()}@test.com`;
    const a = await request(app).post("/api/auth/register").send({ email, password: "firstPass9x", name_fa: "همه" });
    expect(a.status).toBe(200);
    const login = await request(app).post("/api/auth/login").send({ username: email, password: "firstPass9x" });
    expect(login.status).toBe(200);
    const tokA = a.body.token;
    const tokB = login.body.token;
    const kill = await request(app).post("/api/auth/logout-all").set("Authorization", `Bearer ${tokB}`).send({});
    expect(kill.status).toBe(200);
    expect((await request(app).get("/api/auth/me").set("Authorization", `Bearer ${tokA}`)).status).toBe(401);
    expect((await request(app).get("/api/auth/me").set("Authorization", `Bearer ${tokB}`)).status).toBe(401);
  });

  it("kills old JWTs after a password change", async () => {
    const email = `rev_${Date.now()}@test.com`;
    const reg = await request(app).post("/api/auth/register").send({ email, password: "firstPass9x", name_fa: "لغو" });
    expect(reg.status).toBe(200);
    const oldTok = reg.body.token;
    const { db } = await import("../src/db.js");
    const uid = reg.body.user.id;
    const before = db.prepare("SELECT token_ver FROM users WHERE id=?").get(uid);
    const okOld = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${oldTok}`);
    expect(okOld.status).toBe(200);
    const ch = await request(app).put("/api/auth/password").set("Authorization", `Bearer ${oldTok}`)
      .send({ currentPassword: "firstPass9x", newPassword: "secondPass9x" });
    expect(ch.status).toBe(200);
    const after = db.prepare("SELECT token_ver FROM users WHERE id=?").get(uid);
    expect(after?.token_ver, `ver before=${before?.token_ver} after=${after?.token_ver} tok=${oldTok.slice(0, 20)}`).toBeGreaterThan(before?.token_ver || 0);
    const dead = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${oldTok}`);
    expect(dead.status).toBe(401);
    const alive = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${ch.body.token}`);
    expect(alive.status).toBe(200);
  });
});

describe("Google GIS + unsigned-card purge", () => {
  it("exposes JWKS verifier and settings-backed client id helpers", async () => {
    const g = await import("../src/lib/google.js");
    expect(typeof g.verifyWithJwks).toBe("function");
    expect(typeof g.setGoogleClientId).toBe("function");
    expect(g.googleConfigured()).toBe(false);
  });

  it("google login stays 503 until a client id is configured", async () => {
    const res = await request(app).post("/api/auth/google").send({ credential: "x" });
    expect(res.status).toBe(503);
  });

  it("exports purgeUnsignedInOfficialSubjects", async () => {
    const admin = await import("../src/routes/admin.js");
    expect(typeof admin.purgeUnsignedInOfficialSubjects).toBe("function");
  });
});

describe("blog markdown does not treat // as a relative URL", () => {
  it("protocol-relative links become #", () => {
    const html = renderMarkdown("[x](//evil.example/steal)");
    expect(html).not.toMatch(/href="\/\//);
    expect(html).toMatch(/href="#"/);
  });
  it("keeps https and same-origin paths", () => {
    expect(renderMarkdown("[a](https://example.com)")).toMatch(/href="https:\/\/example.com"/);
    expect(renderMarkdown("[a](/uploads/x.png)")).toMatch(/href="\/uploads\/x.png"/);
  });
});

describe("security headers & input validation (v65 hardening)", () => {
  it("sends Permissions-Policy denying sensors/payment/camera/mic", async () => {
    const res = await request(app).get("/api/health");
    const pp = res.headers["permissions-policy"] || "";
    expect(pp).toContain("camera=()");
    expect(pp).toContain("microphone=()");
    expect(pp).toContain("geolocation=()");
    expect(pp).toContain("payment=()");
    expect(pp).toContain("usb=()");
  });

  it("rejects login bodies with unknown keys before touching auth", async () => {
    const res = await request(app).post("/api/auth/login")
      .send({ username: "teacher", password: "demo", role: "admin" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_failed");
    expect(res.body.fields.join(" ")).toContain("role");
  });

  it("rejects over-long login passwords as validation errors", async () => {
    const res = await request(app).post("/api/auth/login")
      .send({ username: "teacher", password: "x".repeat(200) });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_failed");
  });
});

describe("v69 — reflected path in JSON-LD cannot break out of <script>", () => {
  it("escapes </script> inside the ld+json block and keeps the JSON valid", async () => {
    const evil = "/blog/" + encodeURIComponent("</script><script>alert(1)</script>");
    const res = await request(app).get(evil).set("Accept", "text/html");
    expect(res.status).toBe(200);
    const html = res.text;
    expect(html).not.toContain("</script><script>alert(1)");
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    expect(blocks.length).toBeGreaterThan(0);
    for (const b of blocks) expect(() => JSON.parse(b[1])).not.toThrow();
  });
});
