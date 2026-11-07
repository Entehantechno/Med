/* security-hardening.test.js — IP minimisation, login-anomaly alerts, idempotent replay.
   These are unit-level checks; they do not need the AI service or a full seed. */
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import express from "express";
import request from "supertest";
import crypto from "node:crypto";
import { initDb, db } from "../src/db.js";
import { storedIp, storedIpFromReq } from "../src/lib/ip-privacy.js";
import { recordLoginFailure, ACCOUNT_THRESHOLD } from "../src/lib/login-anomaly.js";
import { idempotent } from "../src/lib/idempotency.js";
import { audit } from "../src/lib/audit.js";

beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb();
});

const rid = () => crypto.randomBytes(9).toString("hex");

describe("IP minimisation: persisted addresses are keyed digests", () => {
  it("is deterministic per address, distinct across addresses, and never contains the raw IP", () => {
    const a = storedIp("203.0.113.9");
    expect(a).toBe(storedIp("203.0.113.9"));
    expect(a).not.toBe(storedIp("203.0.113.10"));
    expect(a.startsWith("h:")).toBe(true);
    expect(a).not.toContain("203.0.113");
  });

  it("normalises IPv4-mapped IPv6 and returns empty for no address", () => {
    expect(storedIp("::ffff:203.0.113.9")).toBe(storedIp("203.0.113.9"));
    expect(storedIp("")).toBe("");
    expect(storedIpFromReq({ ip: undefined, socket: {} })).toBe("");
  });

  it("audit rows store the digest, not the address", () => {
    const req = { user: { id: 1, username: "admin" }, ip: "198.51.100.77", headers: { "x-forwarded-for": "10.9.8.7" }, socket: { remoteAddress: "198.51.100.77" } };
    audit(req, "test.ip_minimisation", "probe", null);
    const row = db.prepare("SELECT ip FROM audit_log WHERE action='test.ip_minimisation' ORDER BY id DESC LIMIT 1").get();
    expect(row.ip).toBe(storedIp("198.51.100.77"));
    expect(row.ip).not.toContain("198.51.100");
    expect(row.ip).not.toContain("10.9.8.7");   // spoofable X-Forwarded-For is not used for storage
  });
});

describe("login-failure accounting raises one alert per threshold crossing", () => {
  it("writes a login_anomaly row when one account reaches the threshold, without the username or raw IP", () => {
    const user = `no-such-${rid()}`;
    const req = { ip: "192.0.2.44", headers: { "user-agent": "t" }, socket: { remoteAddress: "192.0.2.44" } };
    for (let i = 0; i < ACCOUNT_THRESHOLD - 1; i++) recordLoginFailure(req, user);
    const before = db.prepare("SELECT COUNT(*) n FROM security_events WHERE kind='login_anomaly'").get().n;
    recordLoginFailure(req, user);                       // the threshold-th failure
    recordLoginFailure(req, user);                       // above threshold: no second alert
    const after = db.prepare("SELECT COUNT(*) n FROM security_events WHERE kind='login_anomaly'").get().n;
    expect(after - before).toBe(1);
    const alert = db.prepare("SELECT detail, ip FROM security_events WHERE kind='login_anomaly' ORDER BY id DESC LIMIT 1").get();
    expect(JSON.parse(alert.detail).scope).toBe("account");
    expect(alert.ip).toBe(storedIp("192.0.2.44"));
    expect(alert.detail).not.toContain(user);
    expect(alert.ip).not.toContain("192.0.2.44");
  });

  it("stores failures with the digest of the username, not the username itself", () => {
    const user = `probe-${rid()}`;
    recordLoginFailure({ ip: "192.0.2.45", headers: {}, socket: {} }, user);
    const rows = db.prepare("SELECT detail FROM security_events WHERE kind='login_failed' AND detail LIKE '%acct%' ORDER BY id DESC LIMIT 5").all();
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.detail).not.toContain(user);
  });
});

describe("Idempotency-Key replay", () => {
  function makeApp(handler) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.user = { id: 4242 }; next(); });
    app.post("/x", idempotent("test.route"), handler);
    return app;
  }

  it("replays the stored response for the same key and body and does not run the handler again", async () => {
    let runs = 0;
    const app = makeApp((req, res) => { runs++; res.status(200).json({ graded: true, n: runs }); });
    const key = rid() + rid();
    const first = await request(app).post("/x").set("Idempotency-Key", key).send({ a: 1, b: [2] });
    const second = await request(app).post("/x").set("Idempotency-Key", key).send({ b: [2], a: 1 }); // key order differs
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.headers["idempotent-replayed"]).toBe("true");
    expect(second.body).toEqual(first.body);
    expect(runs).toBe(1);
  });

  it("refuses the same key with a different body (422)", async () => {
    const app = makeApp((req, res) => res.json({ ok: true }));
    const key = rid() + rid();
    await request(app).post("/x").set("Idempotency-Key", key).send({ a: 1 });
    const r = await request(app).post("/x").set("Idempotency-Key", key).send({ a: 2 });
    expect(r.status).toBe(422);
    expect(r.body.error).toBe("idempotency_key_reused");
  });

  it("answers 409 retryable while the first call is still running", async () => {
    const key = rid() + rid();
    const app = makeApp(() => { /* never responds: first call stays in flight */ });
    request(app).post("/x").set("Idempotency-Key", key).send({ a: 1 }).timeout(200).catch(() => {});
    await new Promise((r) => setTimeout(r, 50));
    const r = await request(app).post("/x").set("Idempotency-Key", key).send({ a: 1 });
    expect(r.status).toBe(409);
    expect(r.body).toMatchObject({ error: "idempotency_in_progress", retryable: true });
  });

  it("does not store server errors, so a retry runs the handler again", async () => {
    let runs = 0;
    const app = makeApp((req, res) => { runs++; if (runs === 1) return res.status(500).json({ error: "boom" }); res.json({ ok: true }); });
    const key = rid() + rid();
    const first = await request(app).post("/x").set("Idempotency-Key", key).send({ a: 1 });
    const second = await request(app).post("/x").set("Idempotency-Key", key).send({ a: 1 });
    expect(first.status).toBe(500);
    expect(second.status).toBe(200);
    expect(runs).toBe(2);
  });

  it("rejects malformed keys and passes requests without a key through unchanged", async () => {
    let runs = 0;
    const app = makeApp((req, res) => { runs++; res.json({ ok: true }); });
    const bad = await request(app).post("/x").set("Idempotency-Key", "short").send({});
    expect(bad.status).toBe(400);
    await request(app).post("/x").send({});
    await request(app).post("/x").send({});
    expect(runs).toBe(2);
  });

  it("scopes keys per user: the same key from another user runs its own request", async () => {
    let runs = 0;
    const key = rid() + rid();
    const handler = (req, res) => { runs++; res.json({ runs }); };
    const appA = express(); appA.use(express.json());
    appA.use((req, _res, next) => { req.user = { id: 1 }; next(); }); appA.post("/x", idempotent("test.scope"), handler);
    const appB = express(); appB.use(express.json());
    appB.use((req, _res, next) => { req.user = { id: 2 }; next(); }); appB.post("/x", idempotent("test.scope"), handler);
    await request(appA).post("/x").set("Idempotency-Key", key).send({});
    await request(appB).post("/x").set("Idempotency-Key", key).send({});
    expect(runs).toBe(2);
  });
});
