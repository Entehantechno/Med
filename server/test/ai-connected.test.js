/* R90: Dr Tutor and the virtual patient are both connected to the configured AI.
   The provider is a stubbed fetch, so no network call is made. Tutor AI is gated by
   tutor_settings.ai_enabled plus a saved key; a failure falls back to the guide. */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { execSync } from "child_process";
import request from "supertest";
import { createApp } from "../src/app.js";
import { initDb, db } from "../src/db.js";
import { patientReply } from "../src/lib/ai-engine.js";
import { setSetting } from "../src/routes/content.js";

let app;
const login = (u, p = "demo") => request(app).post("/api/auth/login").send({ username: u, password: p });
const token = async (u, p = "demo") => (await login(u, p)).body.token;
const A = (tk) => ({ Authorization: `Bearer ${tk}` });
const aiCfg = { provider: "OpenAI", apiKey: "synthetic-key", model: "test-model", baseUrl: "https://provider.invalid/v1", routingEnabled: false };
const okResponse = (text) => new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), { status: 200 });

beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb();
  app = createApp();
});
afterEach(() => { vi.unstubAllGlobals(); setSetting("ai", {}); db.prepare("UPDATE tutor_settings SET enabled=1, ai_enabled=0 WHERE id=1").run(); });

describe("virtual patient is connected to the configured AI", () => {
  it("uses the provider when a key is saved", async () => {
    const fetch = vi.fn().mockResolvedValue(okResponse("درد از دیشب شروع شد."));
    vi.stubGlobal("fetch", fetch);
    const result = await patientReply({ caseData: { chief_fa: "درد قفسه سینه" }, userText: "از کی شروع شده؟", lang: "fa", prompts: {}, aiCfg }, { throwOnError: true });
    expect(result.source).toBe("llm");
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe("Bearer synthetic-key");
  });
  it("falls back to the scripted patient without a key", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const result = await patientReply({ caseData: { chief_fa: "درد قفسه سینه" }, userText: "از کی شروع شده؟", lang: "fa", prompts: {}, aiCfg: {} });
    expect(result.source).toBe("mock");
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("Dr Tutor is connected to the configured AI", () => {
  it("does not call the provider while tutor AI is off", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    setSetting("ai", aiCfg);
    const stk = await token("40012345");
    const res = await request(app).post("/api/tutor/message").set(A(stk)).send({ contextType: "general", message: "سلام" });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe("guide");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("answers through the provider and sends recent history", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(okResponse("پاسخ اول"))
      .mockResolvedValueOnce(okResponse("پاسخ دوم از هوش مصنوعی"));
    vi.stubGlobal("fetch", fetch);
    setSetting("ai", aiCfg);
    db.prepare("UPDATE tutor_settings SET ai_enabled=1 WHERE id=1").run();
    const stk = await token("40012345");
    await request(app).post("/api/tutor/message").set(A(stk)).send({ contextType: "general", message: "سؤال اول" });
    const res = await request(app).post("/api/tutor/message").set(A(stk)).send({ contextType: "general", message: "سؤال دوم" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ reply: "پاسخ دوم از هوش مصنوعی", source: "ai" });
    const body = JSON.parse(fetch.mock.calls[1][1].body);
    const roles = body.messages.map((m) => m.role);
    expect(roles[0]).toBe("system");
    expect(body.messages.at(-1)).toEqual({ role: "user", content: "سؤال دوم" });
    expect(body.messages.some((m) => m.role === "assistant" && m.content === "پاسخ اول")).toBe(true);
    const saved = db.prepare("SELECT meta_json FROM tutor_chats WHERE role='tutor' ORDER BY id DESC LIMIT 1").get();
    expect(JSON.parse(saved.meta_json)).toEqual({ ai: true, source: "ai" });
  });

  it("falls back to the guide when the provider fails, and still saves the exchange", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("boom", { status: 500 })));
    setSetting("ai", aiCfg);
    db.prepare("UPDATE tutor_settings SET ai_enabled=1 WHERE id=1").run();
    const stk = await token("40012345");
    const res = await request(app).post("/api/tutor/message").set(A(stk)).send({ contextType: "general", message: "سؤال خطا" });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe("guide");
    expect(res.body.reply).toContain("سؤال تو");
  });

  it("an exam chat carries the no-final-answer rule to the provider", async () => {
    const fetch = vi.fn().mockResolvedValue(okResponse("راهنمایی: به علائم اولیه فکر کن."));
    vi.stubGlobal("fetch", fetch);
    setSetting("ai", aiCfg);
    db.prepare("UPDATE tutor_settings SET ai_enabled=1 WHERE id=1").run();
    const stu = db.prepare("SELECT id FROM users WHERE username='40012345'").get();
    const ex = db.prepare("INSERT INTO exams (title_en,title_fa,owner_id,university_id,active,tutor_enabled) VALUES ('R90 tutor exam','آزمون',?,1,1,1)")
      .run(db.prepare("SELECT id FROM users WHERE username='teacher'").get().id);
    db.prepare("INSERT OR IGNORE INTO exam_participants (exam_id,user_id) VALUES (?,?)").run(Number(ex.lastInsertRowid), stu.id);
    const stk = await token("40012345");
    const res = await request(app).post("/api/tutor/message").set(A(stk))
      .send({ contextType: "exam", contextId: Number(ex.lastInsertRowid), message: "پاسخ درست کدام است؟" });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe("ai");
    const system = JSON.parse(fetch.mock.calls[0][1].body).messages[0].content;
    expect(system).toContain("هرگز پاسخ نهایی یا شماره گزینه درست را نگو");
  });
});
