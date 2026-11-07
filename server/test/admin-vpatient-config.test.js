// Admin VP settings: every toggle (including the master switch) saves, reads back, and restores;
// learners cannot write them.
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import request from "supertest";
import { initDb } from "../src/db.js";
import { createApp } from "../src/app.js";

let app;
const login = (u, p = "demo") => request(app).post("/api/auth/login").send({ username: u, password: p });
const A = (tk) => ({ Authorization: `Bearer ${tk}` });

beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb();
  app = createApp();
});

describe("admin VP config round trip", () => {
  it("saves each toggle, reads it back, and restores it", async () => {
    const admin = (await login("admin")).body.token;
    const on = { enabled: true, premium_only: false, in_path: true, in_daily: true, daily_gems: 15 };
    const off = { enabled: false, premium_only: true, in_path: false, in_daily: false, daily_gems: 0 };

    const putOff = await request(app).put("/api/admin/vpatient").set(A(admin)).send({ config: off });
    expect(putOff.status).toBe(200);
    expect(putOff.body.config.enabled).toBe(false);
    const readOff = await request(app).get("/api/admin/vpatient").set(A(admin));
    expect(readOff.body.config).toMatchObject(off);

    const putOn = await request(app).put("/api/admin/vpatient").set(A(admin)).send({ config: on });
    expect(putOn.status).toBe(200);
    const readOn = await request(app).get("/api/admin/vpatient").set(A(admin));
    expect(readOn.body.config).toMatchObject(on);
  });

  it("a learner cannot read or change the admin VP config", async () => {
    const learner = (await login("learner")).body.token;
    const put = await request(app).put("/api/admin/vpatient").set(A(learner)).send({ config: { in_daily: false } });
    expect(put.status).toBe(403);
    const get = await request(app).get("/api/admin/vpatient").set(A(learner));
    expect(get.status).toBe(403);
  });
});
