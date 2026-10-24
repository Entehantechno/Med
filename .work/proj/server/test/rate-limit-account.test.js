/* ================================================================
   rate-limit-account.test.js — R56 regression for the API limiter.

   Signed-in traffic is counted per VERIFIED account (so a campus NAT full
   of students is not locked out by one per-IP bucket). Anonymous traffic
   keeps the per-IP bucket. A forged token must NOT buy a fresh bucket.
   ================================================================ */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { initDb, initSchema, db, persistNow } from "../src/db.js";
import { GAME_CONFIG_KEY } from "../src/lib/gameconfig.js";
import { apiLimiter } from "../src/lib/security.js";
import { signToken, JWT_ISS, JWT_AUD } from "../src/lib/auth.js";

let savedRow = null;
let prevDisable;

function buildApp(apiMax, apiUserMax) {
  // Limits are read when the limiter is built, so set them, build, then restore.
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(
    GAME_CONFIG_KEY,
    JSON.stringify({ security: { api_max: apiMax, api_user_max: apiUserMax, api_window_min: 15 } })
  );
  const app = express();
  app.use("/api", apiLimiter());
  app.get("/api/ping", (req, res) => res.json({ ok: true }));
  return app;
}

beforeAll(async () => {
  await initDb();
  initSchema();
  savedRow = db.prepare("SELECT value FROM settings WHERE key=?").get(GAME_CONFIG_KEY) || null;
  prevDisable = process.env.DISABLE_RATE_LIMIT;
  process.env.DISABLE_RATE_LIMIT = "0";
});

afterAll(() => {
  if (savedRow) {
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(GAME_CONFIG_KEY, savedRow.value);
  } else {
    db.prepare("DELETE FROM settings WHERE key=?").run(GAME_CONFIG_KEY);
  }
  persistNow({ force: true });
  process.env.DISABLE_RATE_LIMIT = prevDisable;
});

const bearer = (tk) => ({ Authorization: `Bearer ${tk}` });
const user = (id) => signToken({ id, role: "learner", username: `u${id}`, token_ver: 1 });

describe("R56: API limiter counts signed-in traffic per account", () => {
  it("anonymous traffic is still limited per IP", async () => {
    const app = buildApp(3, 5);
    for (let i = 0; i < 3; i++) expect((await request(app).get("/api/ping")).status).toBe(200);
    expect((await request(app).get("/api/ping")).status).toBe(429);
  });

  it("a signed-in account gets its own bucket, not the shared IP bucket", async () => {
    const app = buildApp(3, 5);
    // Anonymous calls from this IP are not counted against the account's bucket.
    for (let i = 0; i < 5; i++) expect((await request(app).get("/api/ping").set(bearer(user(7)))).status).toBe(200);
    expect((await request(app).get("/api/ping").set(bearer(user(7)))).status).toBe(429);
    // A different student behind the same IP is unaffected.
    expect((await request(app).get("/api/ping").set(bearer(user(8)))).status).toBe(200);
  });

  it("the per-account limit does not affect anonymous requests from the same IP", async () => {
    const app = buildApp(3, 2);
    await request(app).get("/api/ping").set(bearer(user(9)));
    await request(app).get("/api/ping").set(bearer(user(9)));
    expect((await request(app).get("/api/ping").set(bearer(user(9)))).status).toBe(429);
    expect((await request(app).get("/api/ping")).status).toBe(200);
  });

  it("a forged or wrongly-signed token falls back to the per-IP bucket", async () => {
    const app = buildApp(3, 1000);
    const forged = jwt.sign({ id: 42, ver: 1 }, "not-the-real-secret", { algorithm: "HS256", issuer: JWT_ISS, audience: JWT_AUD, expiresIn: "1h" });
    for (let i = 0; i < 3; i++) expect((await request(app).get("/api/ping").set(bearer(forged))).status).toBe(200);
    expect((await request(app).get("/api/ping").set(bearer(forged))).status).toBe(429);
  });
});
