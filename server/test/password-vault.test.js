// Admin password view: the encrypted copy is written on every known password write,
// captured on sign-in for older accounts, sealed at rest, re-checked before it is shown,
// revealed to a full admin only (and audited without the password), and never exported.
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import request from "supertest";
import { initDb, db } from "../src/db.js";
import { createApp } from "../src/app.js";
import { hashPasswordSync } from "../src/lib/password.js";

let app;
const login = (u, p = "demo") => request(app).post("/api/auth/login").send({ username: u, password: p });
const A = (tk) => ({ Authorization: `Bearer ${tk}` });
const uniq = (p) => `${p}${Date.now().toString(36)}${Math.floor(Math.random() * 1e6)}`;

let admin;
beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb();
  app = createApp();
  admin = (await login("admin")).body.token;
});

async function createLearner(password) {
  const username = uniq("vault");
  const res = await request(app).post("/api/admin/users").set(A(admin))
    .send({ username, password, role: "learner", name_fa: "کاربر تست", name_en: "Vault test" });
  expect(res.status).toBe(200);
  return { id: res.body.id, username, password };
}

const reveal = (id, token = admin) => request(app).get(`/api/admin/users/${id}/credentials`).set(A(token));

describe("admin password view", () => {
  it("records the staff-chosen password, flags it as initial, and lets a full admin read it", async () => {
    const u = await createLearner("Staff-Chosen-2026!");
    const r = await reveal(u.id);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ available: true, stale: false, initial: true, password: "Staff-Chosen-2026!" });
    expect(r.headers["cache-control"]).toContain("no-store");
  });

  it("stores the copy sealed at rest, never as plain text", async () => {
    const u = await createLearner("Sealed-Copy-2026!");
    const row = db.prepare("SELECT password_enc FROM users WHERE id=?").get(u.id);
    expect(row.password_enc.startsWith("enc:v1:")).toBe(true);
    expect(row.password_enc).not.toContain("Sealed-Copy-2026!");
  });

  it("prompts on first sign-in, and clears the prompt once the user picks their own password", async () => {
    const u = await createLearner("First-Login-2026!");
    const first = await login(u.username, u.password);
    expect(first.status).toBe(200);
    expect(first.body.user.initial_password).toBe(true);

    const token = first.body.token;
    const changed = await request(app).put("/api/auth/password").set(A(token))
      .send({ currentPassword: u.password, newPassword: "Own-Choice-2026!" });
    expect(changed.status).toBe(200);

    const again = await login(u.username, "Own-Choice-2026!");
    expect(again.body.user.initial_password).toBe(false);
    const r = await reveal(u.id);
    expect(r.body).toMatchObject({ available: true, initial: false, password: "Own-Choice-2026!" });
  });

  it("lets an admin set a new password: the user is signed out, flagged again, and the new one works", async () => {
    const u = await createLearner("Before-Reset-2026!");
    const old = (await login(u.username, u.password)).body.token;
    const set = await request(app).post(`/api/admin/users/${u.id}/password`).set(A(admin))
      .send({ password: "Support-Set-2026!" });
    expect(set.status).toBe(200);

    expect((await request(app).get("/api/auth/me").set(A(old))).status).toBe(401);
    const fresh = await login(u.username, "Support-Set-2026!");
    expect(fresh.status).toBe(200);
    expect(fresh.body.user.initial_password).toBe(true);
    expect((await reveal(u.id)).body).toMatchObject({ available: true, password: "Support-Set-2026!" });
  });

  it("gives an account that has no copy one on its next sign-in, and flags a student still on the default number", async () => {
    const legacy = uniq("legacy");
    const id = db.prepare("INSERT INTO users (username, password_hash, name_fa, name_en, role, status) VALUES (?,?,?,?,'learner','active')")
      .run(legacy, hashPasswordSync("Legacy-Pass-2026!"), "قدیمی", "Legacy").lastInsertRowid;
    expect((await reveal(id)).body).toMatchObject({ available: false, password: null });

    expect((await login(legacy, "Legacy-Pass-2026!")).status).toBe(200);
    expect((await reveal(id)).body).toMatchObject({ available: true, password: "Legacy-Pass-2026!", initial: false });

    const sno = String(40000000 + Math.floor(Math.random() * 9000000));
    const sid = db.prepare("INSERT INTO users (username, password_hash, name_fa, name_en, student_no, role, status) VALUES (?,?,?,?,?, 'student','active')")
      .run(sno, hashPasswordSync(sno), "دانشجو", "Student", sno).lastInsertRowid;
    const signed = await login(sno, sno);
    expect(signed.status).toBe(200);
    expect(signed.body.user.initial_password).toBe(true);
    expect((await reveal(sid)).body).toMatchObject({ available: true, password: sno, initial: true });
  });

  it("never shows a copy that no longer matches the password (for example after a command-line reset)", async () => {
    const u = await createLearner("Matches-Hash-2026!");
    db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(hashPasswordSync("Changed-Outside-2026!"), u.id);
    const r = await reveal(u.id);
    expect(r.body).toMatchObject({ available: false, stale: true, password: null });
  });

  it("refuses teachers, learners and anonymous callers", async () => {
    const u = await createLearner("Guarded-2026!");
    const teacher = (await login("teacher")).body.token;
    const learner = (await login("learner")).body.token;
    expect((await reveal(u.id, teacher)).status).toBe(403);
    expect((await reveal(u.id, learner)).status).toBe(403);
    expect((await request(app).get(`/api/admin/users/${u.id}/credentials`)).status).toBe(401);
  });

  it("audits every reveal without writing the password into the log", async () => {
    const u = await createLearner("Audited-2026!");
    await reveal(u.id);
    const row = db.prepare("SELECT * FROM audit_log WHERE action='user.password_view' AND resource=? ORDER BY id DESC LIMIT 1").get(`users:${u.id}`);
    expect(row).toBeTruthy();
    expect(JSON.stringify(row)).not.toContain("Audited-2026!");
  });

  it("keeps the copy out of the user profile and out of the data export", async () => {
    const u = await createLearner("Not-Exported-2026!");
    const profile = await request(app).get(`/api/admin/users/${u.id}`).set(A(admin));
    expect(profile.status).toBe(200);
    expect(profile.body.user).not.toHaveProperty("password_enc");
    expect(profile.body.user).not.toHaveProperty("password_hash");
    expect(profile.body.user.initial_password).toBeDefined();

    const exported = await request(app).get("/api/admin/export/users").set(A(admin));
    expect(exported.status).toBe(200);
    expect(exported.text).not.toContain("password_enc");
    expect(exported.text).not.toContain("password_hash");
    expect(exported.text).not.toContain("Not-Exported-2026!");
  });
});
