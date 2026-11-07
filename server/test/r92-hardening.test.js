/* R92: bug fixes from the round-92 review.
   1. Dr Tutor accepts only the three known contexts; a general chat ignores contextId.
   2. Tutor and virtual-patient model calls have a per-account turn budget (not the old 80/min).
   3. Deleting an account removes its roster rows and personal tutor chat, the same way
      from the single and the bulk route; attempts (graded records) are kept.
   4. A teacher can save tutor settings for a class whose university_id is NULL, because the
      list already shows it (COALESCE(university_id,1)). */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { execSync } from "child_process";
import request from "supertest";
import { createApp } from "../src/app.js";
import { initDb, db } from "../src/db.js";
import { setSetting } from "../src/routes/content.js";
import { takeAiTurn, resetAiTurnBudgets, aiTurnLimit } from "../src/lib/ai-budget.js";
import { openStudentHold, closeStudentHold } from "../src/lib/retention.js";

let app;
const login = (u, p = "demo") => request(app).post("/api/auth/login").send({ username: u, password: p });
const token = async (u, p = "demo") => (await login(u, p)).body.token;
const A = (tk) => ({ Authorization: `Bearer ${tk}` });
const idOf = (username) => db.prepare("SELECT id FROM users WHERE username=?").get(username).id;
const aiCfg = { provider: "OpenAI", apiKey: "synthetic-key", model: "test-model", baseUrl: "https://provider.invalid/v1", routingEnabled: false };
const okResponse = (text) => new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), { status: 200 });

beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb();
  app = createApp();
});
afterEach(() => {
  vi.unstubAllGlobals();
  setSetting("ai", {});
  db.prepare("UPDATE tutor_settings SET enabled=1, ai_enabled=0 WHERE id=1").run();
  resetAiTurnBudgets();
});

describe("R92 Dr Tutor context validation", () => {
  it("refuses an unknown contextType on send, status and history", async () => {
    const stk = await token("40012345");
    const before = db.prepare("SELECT COUNT(*) n FROM tutor_chats WHERE context_type='zzz-junk'").get().n;
    const post = await request(app).post("/api/tutor/message").set(A(stk)).send({ contextType: "zzz-junk", message: "سلام" });
    expect(post.status).toBe(400);
    expect(post.body.error).toBe("bad_context");
    const st = await request(app).get("/api/tutor/status?contextType=zzz-junk").set(A(stk));
    expect(st.status).toBe(400);
    const hi = await request(app).get("/api/tutor/history?contextType=zzz-junk").set(A(stk));
    expect(hi.status).toBe(400);
    expect(db.prepare("SELECT COUNT(*) n FROM tutor_chats WHERE context_type='zzz-junk'").get().n).toBe(before);
  });

  it("stores a general chat without a context id, whatever contextId was sent", async () => {
    const stk = await token("40012345");
    const res = await request(app).post("/api/tutor/message").set(A(stk)).send({ contextType: "general", contextId: 999, message: "سؤال عمومی" });
    expect(res.status).toBe(200);
    const rows = db.prepare("SELECT context_id FROM tutor_chats WHERE user_id=? AND message='سؤال عمومی'").all(idOf("40012345"));
    expect(rows.length).toBe(1);
    expect(rows[0].context_id).toBeNull();
    expect(db.prepare("SELECT COUNT(*) n FROM tutor_chats WHERE context_type='general' AND context_id=999").get().n).toBe(0);
  });
});

describe("R92 per-account AI turn budget", () => {
  it("counts each kind and each account separately, and resets after the window", () => {
    const old = process.env.DISABLE_RATE_LIMIT;
    process.env.DISABLE_RATE_LIMIT = "0";
    try {
      const t0 = 1_000_000;
      const max = aiTurnLimit("tutor");
      for (let i = 0; i < max; i++) expect(takeAiTurn("tutor", 7, t0)).toBe(true);
      expect(takeAiTurn("tutor", 7, t0)).toBe(false);
      expect(takeAiTurn("tutor", 8, t0)).toBe(true);
      expect(takeAiTurn("vp", 7, t0)).toBe(true);
      expect(takeAiTurn("tutor", 7, t0 + 10 * 60 * 1000)).toBe(true);
    } finally {
      process.env.DISABLE_RATE_LIMIT = old;
    }
  });

  it("does not count when the rate-limit switch is off for tests", () => {
    expect(process.env.DISABLE_RATE_LIMIT).toBe("1");
    for (let i = 0; i < aiTurnLimit("tutor") + 5; i++) expect(takeAiTurn("tutor", 9)).toBe(true);
  });

  it("refuses the tutor model call with 429 once the account is over budget", async () => {
    const old = process.env.DISABLE_RATE_LIMIT;
    const oldMax = process.env.AI_TUTOR_TURNS_PER_10MIN;
    process.env.DISABLE_RATE_LIMIT = "0";
    process.env.AI_TUTOR_TURNS_PER_10MIN = "2";
    try {
      // A fresh Response per call: a Response body can be read only once.
      const fetch = vi.fn().mockImplementation(() => Promise.resolve(okResponse("پاسخ")));
      vi.stubGlobal("fetch", fetch);
      setSetting("ai", aiCfg);
      db.prepare("UPDATE tutor_settings SET enabled=1, ai_enabled=1 WHERE id=1").run();
      const stk = await token("40012345");
      const send = () => request(app).post("/api/tutor/message").set(A(stk)).send({ contextType: "general", message: "سلام" });
      expect((await send()).body.source).toBe("ai");
      expect((await send()).body.source).toBe("ai");
      const third = await send();
      expect(third.status).toBe(429);
      expect(third.body.error).toBe("ai_rate_limited");
      expect(third.body.message_en).toBeTruthy();
      expect(fetch).toHaveBeenCalledTimes(2);
    } finally {
      process.env.DISABLE_RATE_LIMIT = old;
      if (oldMax === undefined) delete process.env.AI_TUTOR_TURNS_PER_10MIN; else process.env.AI_TUTOR_TURNS_PER_10MIN = oldMax;
    }
  });
});

describe("R92 account deletion removes the same rows on both routes", () => {
  function studentWithRows(name) {
    const uid = Number(db.prepare("INSERT INTO users (username,password_hash,role,name_fa,name_en,student_no,status) VALUES (?,?,?,?,?,?,?)")
      .run(name, "x", "student", name, name, name, "active").lastInsertRowid);
    const cls = db.prepare("SELECT id FROM classes ORDER BY id LIMIT 1").get();
    db.prepare("INSERT INTO class_members (class_id,user_id) VALUES (?,?)").run(cls.id, uid);
    db.prepare("INSERT INTO tutor_chats (user_id,context_type,context_id,role,message) VALUES (?,?,?,?,?)").run(uid, "general", null, "user", "private");
    db.prepare("INSERT INTO attempts (user_id,type,score,case_id) VALUES (?,?,?,?)").run(uid, "case", 50, null);
    return uid;
  }
  const counts = (uid) => ({
    members: db.prepare("SELECT COUNT(*) n FROM class_members WHERE user_id=?").get(uid).n,
    chats: db.prepare("SELECT COUNT(*) n FROM tutor_chats WHERE user_id=?").get(uid).n,
    attempts: db.prepare("SELECT COUNT(*) n FROM attempts WHERE user_id=?").get(uid).n,
    user: db.prepare("SELECT COUNT(*) n FROM users WHERE id=?").get(uid).n,
  });

  it("single delete leaves no roster row or personal chat, and keeps the graded attempt", async () => {
    const uid = studentWithRows("r92single");
    const adm = await token("admin");
    const res = await request(app).delete(`/api/admin/users/${uid}`).set(A(adm));
    expect(res.status).toBe(200);
    expect(counts(uid)).toEqual({ members: 0, chats: 0, attempts: 1, user: 0 });
  });

  it("bulk delete does the same", async () => {
    const uid = studentWithRows("r92bulk");
    const adm = await token("admin");
    const res = await request(app).post("/api/admin/users/bulk-delete").set(A(adm)).send({ ids: [uid] });
    expect(res.body.deleted).toEqual([uid]);
    expect(counts(uid)).toEqual({ members: 0, chats: 0, attempts: 1, user: 0 });
  });

  it("an open inspection request still blocks the single delete, and nothing is removed", async () => {
    const uid = studentWithRows("r92held");
    const adm = await token("admin");
    const open = openStudentHold(uid, { reference: "r92" });
    expect(open.created).toBe(true);
    const res = await request(app).delete(`/api/admin/users/${uid}`).set(A(adm));
    expect(res.status).toBe(409);
    expect(counts(uid)).toEqual({ members: 1, chats: 1, attempts: 1, user: 1 });
    closeStudentHold(open.id);
  });
});

describe("R92 teacher tutor settings for a class with no university", () => {
  it("saves the setting for a class the teacher can see in the list", async () => {
    const tch = await token("teacher");
    db.prepare("UPDATE users SET university_id=1 WHERE username='teacher'").run();
    const created = await request(app).post("/api/classes").set(A(tch)).send({ name_en: "R92 uni", name_fa: "دانشگاه", maxAttempts: 2 });
    expect(created.status).toBeLessThan(300);
    const cid = created.body.id;
    db.prepare("UPDATE classes SET university_id=NULL, owner_id=? WHERE id=?").run(idOf("teacher"), cid);
    const list = await request(app).get("/api/tutor/context-settings").set(A(tch));
    expect(list.body.classes.some((c) => c.id === cid)).toBe(true);
    const put = await request(app).put("/api/tutor/context-settings").set(A(tch)).send({ contextType: "class", contextId: cid, enabled: true, prompt: "" });
    expect(put.status).toBe(200);
  });
});
