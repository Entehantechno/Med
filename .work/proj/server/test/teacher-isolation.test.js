/* R51: a teacher sees and manages ONLY the classes and exams they own.
   Other teachers of the same university must not list, open, edit, or read the
   live board / analytics of them. Admin still sees everything. */
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import request from "supertest";
import { createApp } from "../src/app.js";
import { initDb } from "../src/db.js";

let app;
const login = (u, p = "demo") => request(app).post("/api/auth/login").send({ username: u, password: p });
const A = (tk) => ({ Authorization: `Bearer ${tk}` });
const T2_PW = "Teach-Two-2026";

let t1, t2, adm, classId, examId;

beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb();
  app = createApp();
  t1 = (await login("teacher")).body.token;
  adm = (await login("admin")).body.token;
  const made = await request(app).post("/api/admin/users").set(A(adm))
    .send({ username: "colleague2", password: T2_PW, role: "teacher", name_fa: "همکار", name_en: "Colleague", university_id: 1 });
  expect(made.status).toBe(200);
  t2 = (await login("colleague2", T2_PW)).body.token;
  expect(t2).toBeTruthy();
  const cls = await request(app).post("/api/classes").set(A(t1))
    .send({ name_fa: "کلاس استاد اول", name_en: "Teacher one class", maxAttempts: 2 });
  expect(cls.status).toBe(200);
  classId = cls.body.id;
  const ex = await request(app).post("/api/exams").set(A(t1))
    .send({ title_fa: "آزمون استاد اول", title_en: "Teacher one exam", duration_min: 30 });
  expect(ex.status).toBe(200);
  examId = ex.body.id;
});

describe("classes are private to their owner", () => {
  it("the owner still sees and opens their class", async () => {
    const list = await request(app).get("/api/classes").set(A(t1));
    expect(list.body.some((c) => c.id === classId)).toBe(true);
    expect((await request(app).get(`/api/classes/${classId}`).set(A(t1))).status).toBe(200);
  });
  it("the owner can still edit their own class (settings save, no silent logging flip)", async () => {
    const before = (await request(app).get(`/api/classes/${classId}`).set(A(t1))).body.class;
    const put = await request(app).put(`/api/classes/${classId}`).set(A(t1))
      .send({ name_fa: "کلاس ویرایش‌شده", name_en: "Edited class", maxAttempts: 3 });
    expect(put.status).toBe(200);
    const after = (await request(app).get(`/api/classes/${classId}`).set(A(t1))).body.class;
    expect(after.name_en).toBe("Edited class");
    expect(after.log_transcript).toBe(before.log_transcript);
  });
  it("a colleague does not list another teacher's class", async () => {
    const list = await request(app).get("/api/classes").set(A(t2));
    expect(list.status).toBe(200);
    expect(list.body.some((c) => c.id === classId)).toBe(false);
  });
  it("a colleague cannot open, edit, or read the live board / analytics of that class", async () => {
    expect((await request(app).get(`/api/classes/${classId}`).set(A(t2))).status).toBe(403);
    expect((await request(app).put(`/api/classes/${classId}`).set(A(t2)).send({ name_fa: "دزدی" })).status).toBe(403);
    expect((await request(app).get(`/api/classes/${classId}/live-board`).set(A(t2))).status).toBe(403);
    expect((await request(app).get(`/api/classes/${classId}/analytics`).set(A(t2))).status).toBe(403);
    expect((await request(app).get(`/api/classes/${classId}/gradebook.csv`).set(A(t2))).status).toBe(403);
  });
  it("admin still sees every class", async () => {
    const list = await request(app).get("/api/classes").set(A(adm));
    expect(list.body.some((c) => c.id === classId)).toBe(true);
    expect((await request(app).get(`/api/classes/${classId}/live-board`).set(A(adm))).status).toBe(200);
  });
});

describe("exams are private to their owner", () => {
  it("the owner still sees and opens their exam", async () => {
    const list = await request(app).get("/api/exams").set(A(t1));
    expect(list.body.some((e) => e.id === examId)).toBe(true);
    expect((await request(app).get(`/api/exams/${examId}`).set(A(t1))).status).toBe(200);
  });
  it("a colleague does not list another teacher's exam", async () => {
    const list = await request(app).get("/api/exams").set(A(t2));
    expect(list.status).toBe(200);
    expect(list.body.some((e) => e.id === examId)).toBe(false);
  });
  it("a colleague cannot open, edit, delete, or read the analytics of that exam", async () => {
    expect((await request(app).get(`/api/exams/${examId}`).set(A(t2))).status).toBe(403);
    expect((await request(app).put(`/api/exams/${examId}`).set(A(t2)).send({ title_fa: "دزدی" })).status).toBe(403);
    expect((await request(app).delete(`/api/exams/${examId}`).set(A(t2))).status).toBe(403);
    expect((await request(app).get(`/api/exams/${examId}/analytics`).set(A(t2))).status).toBe(403);
  });
});
