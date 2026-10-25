/* R60 — the server refuses a flashcard submission that reports changed answers
   when the exam's teacher/admin switched "change answer" off. Route-level check. */
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import request from "supertest";
import { initDb, db } from "../src/db.js";
import { createApp } from "../src/app.js";

let app;
let examId;
const STUDENT = "40012345";

beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb();
  app = createApp();
  const teacherId = db.prepare("SELECT id FROM users WHERE username='teacher'").get().id;
  const studentId = db.prepare("SELECT id FROM users WHERE username=?").get(STUDENT).id;
  const ins = db.prepare(
    `INSERT INTO exams (title_fa,title_en,case_ids,flashcard_ids,use_flashcards,duration_min,max_attempts,lang,owner_id,university_id,active,flash_allow_change)
     VALUES ('آزمون تست','Change test','[]','[]',1,30,5,'both',?,1,1,NULL)`,
  );
  examId = Number(ins.run(teacherId).lastInsertRowid);
  db.prepare("INSERT INTO exam_participants (exam_id,user_id) VALUES (?,?)").run(examId, studentId);
});

const post = async (answers) => {
  const tk = (await request(app).post("/api/auth/login").send({ username: STUDENT, password: "demo" })).body.token;
  return request(app).post("/api/exam/flashcard-result")
    .set({ Authorization: `Bearer ${tk}` })
    .send({ examId, total: 1, correct: 0, wrong: 1, score: 0, answers });
};

describe("flashcard-result — answer change is enforced by the exam setting (R60)", () => {
  it("refuses changed answers while the exam has change turned off (default)", async () => {
    const res = await post([{ card_id: 1, changes: 1, selectedIdx: 0 }]);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("answer_change_not_allowed");
  });

  it("accepts submissions without changes even when change is off", async () => {
    const res = await post([{ card_id: 1, changes: 0, selectedIdx: 0 }]);
    expect(res.body?.error).not.toBe("answer_change_not_allowed");
  });

  it("accepts changed answers once the teacher turns change on for this exam", async () => {
    db.prepare("UPDATE exams SET flash_allow_change=1 WHERE id=?").run(examId);
    const res = await post([{ card_id: 1, changes: 2, selectedIdx: 1 }]);
    expect(res.body?.error).not.toBe("answer_change_not_allowed");
    db.prepare("UPDATE exams SET flash_allow_change=NULL WHERE id=?").run(examId);
  });
});
