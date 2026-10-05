/* ================================================================
   vp-ai-path.test.js — the virtual-patient LLM path must pick up a
   key from Admin OR env, map OpenRouter models, and not wipe a
   saved key on a later save with an empty password field.
   ================================================================ */
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import request from "supertest";
import { initDb } from "../src/db.js";
import { createApp } from "../src/app.js";
import { resolveAiConfig, resolveAiModel, providerBase, isOpenRouterCfg } from "../src/lib/ai-engine.js";
import { getVpatientAiEffective } from "../src/lib/vpatient.js";

let app;
const login = (u, p = "demo") => request(app).post("/api/auth/login").send({ username: u, password: p });
async function token(u, p = "demo") { return (await login(u, p)).body.token; }
const A = (tk) => ({ Authorization: `Bearer ${tk}` });

beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb();
  app = createApp();
});

describe("resolveAiConfig merges env when the panel is empty", () => {
  it("falls back to AI_* env vars", () => {
    const prev = { ...process.env };
    process.env.AI_PROVIDER = "OpenRouter";
    process.env.AI_MODEL = "openai/gpt-4o-mini";
    process.env.AI_API_KEY = "sk-test-env-key";
    process.env.AI_BASE_URL = "https://openrouter.ai/api/v1";
    try {
      const cfg = resolveAiConfig({});
      expect(cfg.provider).toBe("OpenRouter");
      expect(cfg.model).toBe("openai/gpt-4o-mini");
      expect(cfg.apiKey).toBe("sk-test-env-key");
      expect(cfg.baseUrl).toBe("https://openrouter.ai/api/v1");
    } finally {
      process.env.AI_PROVIDER = prev.AI_PROVIDER;
      process.env.AI_MODEL = prev.AI_MODEL;
      process.env.AI_API_KEY = prev.AI_API_KEY;
      process.env.AI_BASE_URL = prev.AI_BASE_URL;
    }
  });

  it("admin-panel values win over env", () => {
    process.env.AI_API_KEY = "env-key";
    try {
      const cfg = resolveAiConfig({ apiKey: "panel-key", provider: "OpenAI", model: "gpt-4o" });
      expect(cfg.apiKey).toBe("panel-key");
      expect(cfg.provider).toBe("OpenAI");
    } finally {
      delete process.env.AI_API_KEY;
    }
  });

  it("getVpatientAiEffective picks up AI_API_KEY from env when the panel is empty", () => {
    const prev = process.env.AI_API_KEY;
    process.env.AI_API_KEY = "sk-env-vp-live";
    try {
      const cfg = getVpatientAiEffective();
      expect(cfg.apiKey).toBe("sk-env-vp-live");
    } finally {
      if (prev === undefined) delete process.env.AI_API_KEY;
      else process.env.AI_API_KEY = prev;
    }
  });
});

describe("OpenRouter model + base URL", () => {
  it("maps a bare gpt-4o to openai/gpt-4o", () => {
    expect(resolveAiModel({ provider: "OpenRouter", model: "gpt-4o" })).toBe("openai/gpt-4o");
    expect(resolveAiModel({ provider: "OpenRouter", model: "gpt-4o-mini" })).toBe("openai/gpt-4o-mini");
    expect(resolveAiModel({ provider: "OpenRouter", model: "openai/gpt-4o" })).toBe("openai/gpt-4o");
  });

  it("detects OpenRouter from the base URL even if the provider label is Custom", () => {
    expect(isOpenRouterCfg({ provider: "Custom", baseUrl: "https://openrouter.ai/api/v1" })).toBe(true);
    expect(isOpenRouterCfg({ provider: "OpenAI" })).toBe(false);
  });

  it("strips a pasted /chat/completions suffix from the base", () => {
    expect(providerBase("OpenAI", "https://api.openai.com/v1/chat/completions"))
      .toBe("https://api.openai.com/v1");
    expect(providerBase("OpenRouter", "https://openrouter.ai/api/v1/"))
      .toBe("https://openrouter.ai/api/v1");
  });

  it("maps Iranian providers to their OpenAI-compatible bases", () => {
    expect(providerBase("GapGPT", "")).toBe("https://api.gapgpt.app/v1");
    expect(providerBase("AvalAI", "")).toBe("https://api.avalai.ir/v1");
    expect(providerBase("MetisAI", "")).toBe("https://api.metisai.ir/openai/v1");
    expect(providerBase("Liara AI", "")).toBe("https://ai.liara.ir/api/v1");
  });

  it("does not silently send Custom/empty providers to OpenAI", () => {
    expect(providerBase("Custom", "")).toBe("");
    expect(providerBase("", "")).toBe("");
    expect(providerBase("Azure OpenAI", "")).toBe("");
  });
});

describe("admin AI settings + exam/ai-test", () => {
  it("ai-test without a key reports mock (not a 500)", async () => {
    const tk = await token("admin");
    const r = await request(app).post("/api/exam/ai-test").set(A(tk)).send({ lang: "fa" });
    expect(r.status).toBe(200);
    expect(r.body.connected).toBe(false);
    expect(r.body.mode).toBe("mock");
  });

  it("saving AI config with an empty apiKey does not wipe a stored key", async () => {
    const tk = await token("admin");
    const first = await request(app).put("/api/settings/ai").set(A(tk))
      .send({ provider: "OpenRouter", model: "openai/gpt-4o-mini", apiKey: "sk-keep-me", baseUrl: "https://openrouter.ai/api/v1" });
    expect(first.status).toBe(200);
    const wipe = await request(app).put("/api/settings/ai").set(A(tk))
      .send({ provider: "OpenRouter", model: "openai/gpt-4o-mini", apiKey: "", baseUrl: "https://openrouter.ai/api/v1" });
    expect(wipe.status).toBe(200);
    const got = await request(app).get("/api/settings/ai").set(A(tk));
    expect(got.status).toBe(200);
    expect(got.body.apiKey).toBe("sk-keep-me");
  });

  it("teachers can list providers (needed by the AI config dropdown)", async () => {
    const tk = await token("teacher");
    const r = await request(app).get("/api/exam/ai-providers").set(A(tk));
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
    expect(r.body.some((p) => p.key === "OpenRouter")).toBe(true);
  });
});
