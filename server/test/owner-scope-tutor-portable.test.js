/* Owner-only tutor context settings and admin-only university portable backup (R52).
   A teacher sees and edits tutor settings only for their own classes/exams.
   Teachers cannot export or validate the whole-university portable bundle. */
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import request from "supertest";
import { createApp } from "../src/app.js";
import { initDb } from "../src/db.js";

let app;
const login = (u, p = "demo") => request(app).post("/api/auth/login").send({ username: u, password: p });
const token = async (u, p = "demo") => (await login(u, p)).body.token;
const A = (tk) => ({ Authorization: `Bearer ${tk}` });

let adm, tA, tB, clsId;

beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb();
  app = createApp();
  adm = await token("admin");
  tA = await token("teacher");
  const pw = "Colleague-R52-pass";
  const u = `colleague_r52_${Date.now()}`;
  const made = await request(app).post("/api/users").set(A(adm))
    .send({ username: u, password: pw, role: "teacher", name_fa: "همکار", name_en: "Colleague", university_id: 1 });
  expect(made.status).toBe(200);
  tB = await token(u, pw);
});

describe("tutor context settings are owner-only for teachers", () => {
  it("a teacher's own class appears to the owner and admin but not to a same-university colleague", async () => {
    const cls = await request(app).post("/api/classes").set(A(tA)).send({ name_en: "R52 tutor", name_fa: "مربی", maxAttempts: 2 });
    expect(cls.status).toBe(200);
    clsId = cls.body.id;

    const own = await request(app).get("/api/tutor/context-settings").set(A(tA));
    expect(own.status).toBe(200);
    expect(own.body.classes.map((c) => c.id)).toContain(clsId);

    const peer = await request(app).get("/api/tutor/context-settings").set(A(tB));
    expect(peer.status).toBe(200);
    expect(peer.body.classes.map((c) => c.id)).not.toContain(clsId);

    const adminView = await request(app).get("/api/tutor/context-settings").set(A(adm));
    expect(adminView.body.classes.map((c) => c.id)).toContain(clsId);
  });

  it("a colleague cannot change the tutor prompt of another teacher's class; the owner can", async () => {
    const denied = await request(app).put("/api/tutor/context-settings").set(A(tB))
      .send({ contextType: "class", contextId: clsId, enabled: true, prompt: "hijack" });
    expect(denied.status).toBe(403);
    expect(denied.body.error).toBe("not_owner");

    const ok = await request(app).put("/api/tutor/context-settings").set(A(tA))
      .send({ contextType: "class", contextId: clsId, enabled: true, prompt: "owner prompt" });
    expect(ok.status).toBe(200);
  });
});

describe("university portable backup is admin-only", () => {
  it("teachers cannot export or validate the whole-university bundle", async () => {
    const exp = await request(app).post("/api/academic/portable/export").set(A(tA)).send({});
    expect(exp.status).toBe(403);
    const val = await request(app).get("/api/academic/portable/validate").set(A(tA));
    expect(val.status).toBe(403);
    const expB = await request(app).post("/api/academic/portable/export").set(A(tB)).send({});
    expect(expB.status).toBe(403);
  });

  it("admin can still reach the portable endpoints", async () => {
    const val = await request(app).get("/api/academic/portable/validate").set(A(adm));
    expect(val.status).toBe(200);
  });
});
