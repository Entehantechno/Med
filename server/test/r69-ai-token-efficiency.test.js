// Round 69: AI token and cost controls, plus the patient-chart leak fix.
// (1) The patient's chart view no longer carries lab/imaging RESULT text, image
//     labels, or the diagnosis hidden in the title.
// (2) Every real call carries a per-stage output ceiling (max_tokens). Patient
//     calls on OpenRouter carry a hashed session_id (sticky routing). Anthropic
//     patient calls carry the cache marker. Single-shot calls never do.
// (3) A 400 that says "context too long" is NOT retried (retrying resends the whole
//     prompt for nothing). A 400 that rejects max_tokens is retried ONCE without it.
// (4) The usage meter stores counts only and is readable from the admin summary.
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { initDb } from "../src/db.js";
import { patientReply, sanitizeCaseForPatient, translateNoteText } from "../src/lib/ai-engine.js";
import { recordAiUsage, aiUsageSummary } from "../src/lib/ai-usage.js";
import { EMERGENCY_TEN } from "../src/data/vp-emergency-ten.js";
import request from "supertest";
import { createApp } from "../src/app.js";
// Each entry wraps the case: { difficulty, checklist_id, data: { ...case } }.
const CASES = EMERGENCY_TEN.map((e) => e.data || e);

const OR_CLAUDE = { provider: "OpenRouter", model: "anthropic/claude-sonnet-4.6", apiKey: "test-only-not-a-secret" };
const OR_GPT = { provider: "OpenRouter", model: "openai/gpt-4o-mini", apiKey: "test-only-not-a-secret" };
const DIRECT_OPENAI = { provider: "OpenAI", model: "gpt-4o-mini", apiKey: "test-only-not-a-secret" };
const CASE = { chief_fa: "درد قفسه سینه", history_fa: "درد فشارنده از یک ساعت پیش، انتشار به بازو", chief_en: "chest pain", history_en: "pressure-like pain for an hour" };
const STUDENT = { name_fa: "علی رضایی" };

function okReply(text = "بله، از یک ساعت پیش.") {
  return { ok: true, status: 200, headers: new Headers(), json: async () => ({ model: "x", choices: [{ message: { content: text } }] }), text: async () => "", clone() { return this; } };
}
function usageReply(text, usage) {
  return { ok: true, status: 200, headers: new Headers(), json: async () => ({ model: "anthropic/claude-sonnet-4.6", choices: [{ message: { content: text } }], usage }), text: async () => "", clone() { return this; } };
}
function badReply(status, body) {
  const mk = () => ({ ok: false, status, headers: new Headers(), text: async () => body, json: async () => ({}), clone: mk });
  return mk();
}
const sentBodies = (spy) => spy.mock.calls.map(([, init]) => JSON.parse(init.body));

describe("R69 patient chart: no results, no image labels, no diagnosis in the title", () => {
  it("the fixture really contains results, image labels and a diagnosed title (non-vacuous)", () => {
    expect(CASES.filter((c) => c.labs_fa).length).toBeGreaterThanOrEqual(5);
    expect(CASES.filter((c) => c.imaging_fa).length).toBeGreaterThanOrEqual(5);
    expect(CASES.filter((c) => /\(/.test(c.title_en || "")).length).toBeGreaterThanOrEqual(5);
  });

  it("drops labs_*, imaging_* and images from the patient view", () => {
    for (const c of CASES) {
      const safe = sanitizeCaseForPatient(c);
      expect(safe).not.toHaveProperty("labs_fa");
      expect(safe).not.toHaveProperty("labs_en");
      expect(safe).not.toHaveProperty("imaging_fa");
      expect(safe).not.toHaveProperty("imaging_en");
      expect(safe).not.toHaveProperty("images");
    }
  });

  it("does not leak the lab/imaging result text or the diagnosis into the patient JSON", () => {
    for (const c of CASES) {
      const json = JSON.stringify(sanitizeCaseForPatient(c));
      if (c.labs_fa) expect(json).not.toContain(String(c.labs_fa).slice(0, 25));
      if (c.imaging_fa) expect(json).not.toContain(String(c.imaging_fa).slice(0, 25));
      if (c.diagnosis_en) expect(json).not.toContain(c.diagnosis_en);
      if (c.diagnosis_fa) expect(json).not.toContain(c.diagnosis_fa);
    }
  });

  it("keeps the presentation in the title and drops the parenthetical diagnosis", () => {
    const c = { title_en: "Chest Pain in a 58-Year-Old Man — Emergency (Acute Coronary Syndrome)", title_fa: "درد قفسه سینه در مرد ۵۸ ساله — اورژانس (سندرم حاد کرونری)", chief_fa: "x" };
    const safe = sanitizeCaseForPatient(c);
    expect(safe.title_en).toBe("Chest Pain in a 58-Year-Old Man");
    expect(safe.title_fa).toBe("درد قفسه سینه در مرد ۵۸ ساله");
  });

  it("leaves titles without a dash untouched and keeps chief/history", () => {
    const safe = sanitizeCaseForPatient({ title_en: "COVID-19 follow-up", chief_en: "cough", history_en: "dry cough for 3 days" });
    expect(safe.title_en).toBe("COVID-19 follow-up");
    expect(safe.chief_en).toBe("cough");
    expect(safe.history_en).toBe("dry cough for 3 days");
  });
});

describe("R69 request shape", () => {
  let spy;
  afterEach(() => { vi.unstubAllGlobals(); });

  it("patient call on OpenRouter+Anthropic: max_tokens, hashed session_id and the cache marker", async () => {
    spy = vi.fn(async () => okReply());
    vi.stubGlobal("fetch", spy);
    await patientReply({ caseData: CASE, userText: "سلام", history: [], lang: "fa", prompts: {}, aiCfg: OR_CLAUDE },
      { seed: "s1", sessionKey: "abc123", student: STUDENT, throwOnError: true });
    const [body] = sentBodies(spy);
    expect(body.max_tokens).toBe(2048);
    expect(body.session_id).toBe("abc123");
    expect(body.cache_control).toEqual({ type: "ephemeral" });
  });

  it("VP_PROMPT_CACHE=0 switches the Anthropic marker off (ops kill switch)", async () => {
    const prev = process.env.VP_PROMPT_CACHE;
    process.env.VP_PROMPT_CACHE = "0";
    try {
      const spy = vi.fn(async () => okReply());
      vi.stubGlobal("fetch", spy);
      await patientReply({ caseData: CASE, userText: "سلام", history: [], lang: "fa", prompts: {}, aiCfg: OR_CLAUDE }, { seed: "s", sessionKey: "k", student: STUDENT, throwOnError: true });
      const [body] = sentBodies(spy);
      expect(body).not.toHaveProperty("cache_control");
      expect(body.session_id).toBe("k");
    } finally {
      if (prev === undefined) delete process.env.VP_PROMPT_CACHE; else process.env.VP_PROMPT_CACHE = prev;
    }
  });

  it("the patient system prompt is byte-identical across turns of one encounter (cache prefix)", async () => {
    spy = vi.fn(async () => okReply());
    vi.stubGlobal("fetch", spy);
    const history = [{ role: "student", text: "سلام، شما چطورید؟" }, { role: "patient", text: "درد دارم." }];
    await patientReply({ caseData: CASE, userText: "کی شروع شد؟", history, lang: "fa", prompts: {}, aiCfg: OR_CLAUDE }, { seed: "s1", sessionKey: "k", student: STUDENT, throwOnError: true });
    await patientReply({ caseData: CASE, userText: "چه دارویی مصرف می‌کنید؟", history: [...history, { role: "student", text: "کی شروع شد؟" }, { role: "patient", text: "دیشب." }], lang: "fa", prompts: {}, aiCfg: OR_CLAUDE }, { seed: "s1", sessionKey: "k", student: STUDENT, throwOnError: true });
    const [a, b] = sentBodies(spy);
    expect(a.messages[0].role).toBe("system");
    expect(b.messages[0].content).toBe(a.messages[0].content);
  });

  it("non-Anthropic OpenRouter model: no cache marker, but still max_tokens and session_id", async () => {
    spy = vi.fn(async () => okReply());
    vi.stubGlobal("fetch", spy);
    await patientReply({ caseData: CASE, userText: "سلام", history: [], lang: "fa", prompts: {}, aiCfg: OR_GPT }, { seed: "s1", sessionKey: "k2", student: STUDENT, throwOnError: true });
    const [body] = sentBodies(spy);
    expect(body).not.toHaveProperty("cache_control");
    expect(body.max_tokens).toBe(2048);
    expect(body.session_id).toBe("k2");
  });

  it("direct (non-OpenRouter) provider: no session_id and no cache marker", async () => {
    spy = vi.fn(async () => okReply());
    vi.stubGlobal("fetch", spy);
    await patientReply({ caseData: CASE, userText: "سلام", history: [], lang: "fa", prompts: {}, aiCfg: DIRECT_OPENAI }, { seed: "s1", sessionKey: "k3", student: STUDENT, throwOnError: true });
    const [body] = sentBodies(spy);
    expect(body).not.toHaveProperty("session_id");
    expect(body).not.toHaveProperty("cache_control");
  });

  it("translation (single-shot) has no output cap and no cache marker", async () => {
    spy = vi.fn(async () => okReply("translated"));
    vi.stubGlobal("fetch", spy);
    await translateNoteText({ text: "keep going", from: "en", to: "fa", aiCfg: OR_CLAUDE });
    const [body] = sentBodies(spy);
    expect(body).not.toHaveProperty("max_tokens");
    expect(body).not.toHaveProperty("cache_control");
  });
});

describe("R69 retry policy on 400/422", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("does not resend when the prompt is too long (one request, then a clean error)", async () => {
    const spy = vi.fn(async () => badReply(400, JSON.stringify({ error: { message: "This model's maximum context length is 8192 tokens. However, your messages resulted in 9000 tokens." } })));
    vi.stubGlobal("fetch", spy);
    await expect(patientReply({ caseData: CASE, userText: "سلام", history: [], lang: "fa", prompts: {}, aiCfg: OR_GPT }, { seed: "s", student: STUDENT, throwOnError: true })).rejects.toThrow();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("retries ONCE without max_tokens when the provider rejects that parameter", async () => {
    let n = 0;
    const spy = vi.fn(async (_u, init) => {
      n += 1;
      if (n === 1) return badReply(400, JSON.stringify({ error: { message: "Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead." } }));
      return okReply("بله");
    });
    vi.stubGlobal("fetch", spy);
    const out = await patientReply({ caseData: CASE, userText: "سلام", history: [], lang: "fa", prompts: {}, aiCfg: OR_GPT }, { seed: "s", student: STUDENT, throwOnError: true });
    expect(out.text).toBeTruthy();
    expect(spy).toHaveBeenCalledTimes(2);
    const [first, second] = sentBodies(spy);
    expect(first.max_tokens).toBe(2048);
    expect(second).not.toHaveProperty("max_tokens");
  });

  it("a generic 400 still falls back as before (system message merged)", async () => {
    let n = 0;
    const spy = vi.fn(async () => {
      n += 1;
      if (n === 1) return badReply(400, JSON.stringify({ error: { message: "Invalid role: system" } }));
      return okReply("بله");
    });
    vi.stubGlobal("fetch", spy);
    await patientReply({ caseData: CASE, userText: "سلام", history: [], lang: "fa", prompts: {}, aiCfg: OR_GPT }, { seed: "s", student: STUDENT, throwOnError: true });
    expect(spy).toHaveBeenCalledTimes(2);
    const second = sentBodies(spy)[1];
    expect(second.messages.every((m) => m.role !== "system")).toBe(true);
  });
});

describe("R69 usage meter (counts only)", () => {
  beforeAll(async () => { await initDb(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("records token counts and cache numbers from the provider usage block", async () => {
    const before = aiUsageSummary({ days: 1 }).totals;
    vi.stubGlobal("fetch", vi.fn(async () => usageReply("بله", {
      prompt_tokens: 1500, completion_tokens: 40,
      prompt_tokens_details: { cached_tokens: 1200, cache_write_tokens: 0 },
    })));
    await patientReply({ caseData: CASE, userText: "سلام", history: [], lang: "fa", prompts: {}, aiCfg: OR_CLAUDE }, { seed: "s", sessionKey: "k", student: STUDENT, throwOnError: true });
    const after = aiUsageSummary({ days: 1 });
    expect(after.totals.calls).toBe(before.calls + 1);
    expect(after.totals.prompt_tokens - before.prompt_tokens).toBe(1500);
    expect(after.totals.cached_tokens - before.cached_tokens).toBe(1200);
    expect(after.totals.cache_hit_ratio).toBeGreaterThan(0);
    const row = after.rows.find((r) => r.stage === "patient");
    expect(row).toBeTruthy();
    expect(Object.keys(row).sort()).toEqual(["cache_write_tokens", "cached_tokens", "calls", "completion_tokens", "model", "prompt_tokens", "provider", "stage"]);
  });

  it("stores nothing when there is no usage block, and never throws", () => {
    const before = aiUsageSummary({ days: 1 }).totals.calls;
    expect(recordAiUsage({ stage: "x", usage: null })).toBe(false);
    expect(aiUsageSummary({ days: 1 }).totals.calls).toBe(before);
  });

  it("summary clamps the window and tolerates bad input", () => {
    expect(aiUsageSummary({ days: "abc" }).days).toBe(7);
    expect(aiUsageSummary({ days: 9999 }).days).toBe(90);
  });
});

describe("R69 admin usage route is not public", () => {
  let app;
  beforeAll(async () => { await initDb(); app = createApp(); });
  it("GET /api/admin/ai-usage without a login is refused", async () => {
    const res = await request(app).get("/api/admin/ai-usage").set("Origin", "http://localhost:4000");
    expect([401, 403]).toContain(res.status);
    expect(res.text).not.toMatch(/"calls"/);
  });
});
