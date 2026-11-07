/* The dashboard summary is computed in SQL (R75). It must agree with the trusted
   full-list computation over /reports/attempts, for admin and for a teacher whose
   scope is their own classes and exams only. */
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import request from "supertest";
import { createApp } from "../src/app.js";
import { initDb, db } from "../src/db.js";

let app;
const login = (u, p = "demo") => request(app).post("/api/auth/login").send({ username: u, password: p });
const token = async (u, p = "demo") => (await login(u, p)).body.token;
const A = (tk) => ({ Authorization: `Bearer ${tk}` });

let adm, teacher, ownClass, ownExam;

beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb();
  app = createApp();
  adm = await token("admin");
  teacher = await token("teacher");
  const teacherId = db.prepare("SELECT id FROM users WHERE username='teacher'").get().id;
  const uni = db.prepare("SELECT COALESCE(university_id,1) u FROM users WHERE username='teacher'").get().u;
  const student = db.prepare("SELECT id FROM users WHERE role='student' ORDER BY id LIMIT 1").get().id;
  ownClass = db.prepare("INSERT INTO classes (name_en, name_fa, owner_id, university_id, max_attempts) VALUES ('dash own', 'داشبورد', ?, ?, 3)").run(teacherId, uni).lastInsertRowid;
  ownExam = db.prepare("INSERT INTO exams (title_en, title_fa, owner_id, university_id, active) VALUES ('dash exam', 'آزمون', ?, ?, 1)").run(teacherId, uni).lastInsertRowid;
  // Another teacher's class (owner_id = a different user) must stay out of the teacher's dashboard.
  const other = db.prepare("SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1").get().id;
  const foreignClass = db.prepare("INSERT INTO classes (name_en, name_fa, owner_id, university_id, max_attempts) VALUES ('dash foreign', 'خارجی', ?, ?, 3)").run(other, uni).lastInsertRowid;
  const ins = db.prepare("INSERT INTO attempts (user_id, type, case_id, class_id, exam_id, score, created_at) VALUES (?, ?, 1, ?, ?, ?, ?)");
  const rows = [
    [student, "vp", ownClass, null, 35, 1000], [student, "vp", ownClass, null, 62, 1100],
    [student, "flash", ownClass, null, 78, 1200], [student, "vp", null, ownExam, 91, 1300],
    [student, "vp", null, ownExam, null, 1400], [student, "flash", foreignClass, null, 99, 1500],
    [student, "vp", foreignClass, null, 10, 1600], [student, "vp", null, null, 55, 1700],
  ];
  for (const [u, type, cls, ex, score, t] of rows) ins.run(u, type, cls, ex, score, new Date(t * 1000).toISOString());
});

const expected = (list) => {
  const scores = list.map((a) => a.score || 0);
  const avg = scores.length ? scores.reduce((s, x) => s + x, 0) / scores.length : 0;
  const b = [0, 0, 0, 0];
  for (const sc of scores) (sc < 60 ? b[0]++ : sc < 75 ? b[1]++ : sc < 90 ? b[2]++ : b[3]++);
  const chrono = [...list].reverse();
  return {
    attempts: list.length,
    avgScore: Math.round(avg),
    byType: { vp: list.filter((a) => a.type === "vp").length, flash: list.filter((a) => a.type === "flash").length },
    buckets: b,
    trend: chrono.map((a) => a.score).slice(-12),
    recentIds: list.slice(0, 6).map((a) => a.id),
  };
};

describe("dashboard summary matches the full-list computation", () => {
  it("admin sees every attempt", async () => {
    const full = (await request(app).get("/api/reports/attempts").set(A(adm))).body;
    const s = (await request(app).get("/api/reports/summary").set(A(adm))).body;
    const e = expected(full);
    expect(s.attempts).toBe(e.attempts);
    expect(s.avgScore).toBe(e.avgScore);
    expect(s.byType).toEqual(e.byType);
    expect(s.buckets).toEqual(e.buckets);
    expect(s.trend).toEqual(e.trend);
    expect(s.recent.map((a) => a.id)).toEqual(e.recentIds);
  });

  it("a teacher sees only attempts in their own classes or exams", async () => {
    const full = (await request(app).get("/api/reports/attempts").set(A(teacher))).body;
    const s = (await request(app).get("/api/reports/summary").set(A(teacher))).body;
    const e = expected(full);
    expect(full.length).toBeGreaterThan(0);
    expect(s.attempts).toBe(e.attempts);
    expect(s.avgScore).toBe(e.avgScore);
    expect(s.byType).toEqual(e.byType);
    expect(s.buckets).toEqual(e.buckets);
    expect(s.recent.map((a) => a.id)).toEqual(e.recentIds);
    expect(s.recent.every((a) => a.class_id === ownClass || a.exam_id === ownExam)).toBe(true);
  });

  it("keeps the summary keys the dashboard reads", async () => {
    const s = (await request(app).get("/api/reports/summary").set(A(adm))).body;
    expect(Object.keys(s).sort()).toEqual(["attempts", "avgScore", "buckets", "byType", "cards", "cases", "exams", "recent", "students", "trend"].sort());
  });
});
