/* Full virtual-patient stages: session → chat → order → AI score + lesson. */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { execSync } from "node:child_process";
import request from "supertest";
import { initDb, db } from "../src/db.js";
import { createApp } from "../src/app.js";
import { setSetting } from "../src/routes/content.js";

let app;
const login = (u, p = "demo") => request(app).post("/api/auth/login").send({ username: u, password: p });
async function token(u, p = "demo") { return (await login(u, p)).body.token; }
const A = (tk) => ({ Authorization: `Bearer ${tk}` });

const lesson = {
  strengths: [],
  weaknesses: ["زمان شروع درد را صریح بپرسید."],
  missed: [],
  commonMistakes: [],
  suggestion: "شرح‌حال را با استاد مرور کنید.",
  microlearning: "### درسنامه هدفمند\nزمان شروع درد را صریح بپرسید و پاسخ را در شرح‌حال ثبت کنید. سپس معیارهای جامانده را با استاد مرور کنید.",
};

function provider() {
  vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
    const body = JSON.parse(init.body);
    const user = body.messages.at(-1).content;
    const isScore = String(user).startsWith("RUBRIC:");
    if (isScore) {
      const rubric = JSON.parse(user.split("RUBRIC:\n")[1].split("\n\nAUTHORITATIVE_REFERENCE:")[0]);
      return {
        ok: true, status: 200,
        json: async () => ({ choices: [{ message: { content: JSON.stringify({ items: rubric.map((r) => ({ id: r.id, done: false, reason: "شاهد کافی ثبت نشده است." })) }) } }] }),
      };
    }
    return {
      ok: true, status: 200,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(lesson) } }] }),
    };
  }));
}

beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb();
  app = createApp();
});
beforeEach(() => {
  vi.stubEnv("VP_REQUIRE_AI_EVALUATION", "1");
  vi.stubEnv("AI_API_KEY", "");
  setSetting("ai", { provider: "OpenRouter", model: "test/free", apiKey: "synthetic-only" });
  setSetting("ai_vpatient", {});
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("student virtual-patient stages", () => {
  it("opens a session, replies as the patient, returns a chart ECG, then stores AI score + lesson", async () => {
    provider();
    const stk = await token("40012345");
    const started = await request(app).post("/api/exam/session-start").set(A(stk))
      .send({ caseId: 1, lang: "fa" });
    expect(started.status).toBe(200);
    expect(started.body.sessionId).toBeTruthy();

    const chat = await request(app).post("/api/exam/patient-reply").set(A(stk)).send({
      caseId: 1, lang: "fa", userText: "سلام من پزشک هستم، اجازه می‌دهید بپرسم درد از کی شروع شده؟",
      history: [],
    });
    expect(chat.status).toBe(200);
    expect(String(chat.body.text || "").trim().length).toBeGreaterThan(0);
    expect(["patient", "exam"]).toContain(chat.body.mode || "patient");

    const vitals = await request(app).post("/api/exam/patient-reply").set(A(stk)).send({
      caseId: 1, lang: "fa", userText: "فشار خون را بگیرید",
      history: [
        { role: "student", text: "سلام من پزشک هستم، اجازه می‌دهید بپرسم درد از کی شروع شده؟" },
        { role: "patient", text: chat.body.text },
      ],
    });
    expect(vitals.status).toBe(200);
    expect(vitals.body.mode).toBe("exam");
    expect(String(vitals.body.text || "").trim().length).toBeGreaterThan(0);

    const order = await request(app).post("/api/exam/order").set(A(stk)).send({
      caseId: 1, kind: "imaging", query: "ECG", lang: "fa",
    });
    expect(order.status).toBe(200);
    expect(order.body.found).toBe(true);
    expect(String(order.body.text || "")).toMatch(/ST|صعود|نوار|ECG/i);

    const para = await request(app).post("/api/exam/order").set(A(stk)).send({
      caseId: 1, kind: "paraclinic", query: "نوار قلب", lang: "fa",
    });
    expect(para.status).toBe(200);
    expect(para.body.found).toBe(true);

    const n = db.prepare("SELECT COUNT(*) n FROM attempts").get().n;
    const session = {
      messages: [
        { role: "student", text: "سلام من پزشک هستم، اجازه می‌دهید بپرسم درد از کی شروع شده؟" },
        { role: "patient", text: chat.body.text },
      ],
      problemList: ["درد قفسه سینه"],
      ddx: ["ACS"],
      tests: ["Troponin"],
      imaging: ["ECG"],
      finalDx: "STEMI",
    };
    const ev = await request(app).post("/api/exam/evaluate").set(A(stk)).send({
      caseId: 1, lang: "fa", session, durationSec: 90, sessionId: started.body.sessionId,
    });
    expect(ev.status).toBe(200);
    expect(ev.body.source).toBe("llm");
    expect(ev.body.feedbackSource).toBe("llm");
    expect(ev.body.attemptStored === false).toBe(false);
    expect(ev.body.attemptId).toBeTruthy();
    expect(String(ev.body.microlearning || "")).toContain("درسنامه");
    expect(Array.isArray(ev.body.results)).toBe(true);
    expect(ev.body.results.length).toBeGreaterThan(2);
    expect(db.prepare("SELECT COUNT(*) n FROM attempts").get().n).toBe(n + 1);

    const replay = await request(app).post("/api/exam/evaluate").set(A(stk)).send({
      caseId: 1, lang: "fa", session, durationSec: 90, sessionId: started.body.sessionId,
    });
    expect(replay.status).toBe(200);
    expect(replay.body.replayed).toBe(true);
    expect(replay.body.attemptId).toBe(ev.body.attemptId);
    expect(db.prepare("SELECT COUNT(*) n FROM attempts").get().n).toBe(n + 1);
  });

  it("does not consume an attempt when the student evaluates without a session", async () => {
    const stk = await token("40012345");
    const n = db.prepare("SELECT COUNT(*) n FROM attempts").get().n;
    const r = await request(app).post("/api/exam/evaluate").set(A(stk)).send({
      caseId: 1, lang: "fa", session: { messages: [], problemList: [], ddx: [] }, durationSec: 10,
    });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("session_id_required");
    expect(countAttempts()).toBe(n);
  });
});

function countAttempts() { return db.prepare("SELECT COUNT(*) n FROM attempts").get().n; }
