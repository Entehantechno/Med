/* /VP page copy: public read with defaults, admin write behind uni.content,
   and normalization that keeps stored text plain, bounded, and renderable. */
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import request from "supertest";
import { initDb, db } from "../src/db.js";
import { createApp } from "../src/app.js";
import { normalizeVpPage, DEFAULT_VP_PAGE, VP_PAGE_LIMITS } from "../src/lib/vp-page.js";

let app;
const login = (u, p = "demo") => request(app).post("/api/auth/login").send({ username: u, password: p });
const A = (tk) => ({ Authorization: `Bearer ${tk}` });

beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb();
  app = createApp();
});

describe("normalizeVpPage", () => {
  it("fills every field from the defaults when given nothing", () => {
    expect(normalizeVpPage(undefined)).toEqual(DEFAULT_VP_PAGE);
    expect(normalizeVpPage("not an object")).toEqual(DEFAULT_VP_PAGE);
  });

  it("strips markup and control characters and caps every string", () => {
    const out = normalizeVpPage({ headline: { fa: "  <b>سلام</b>\u0000\n  دنیا ", en: "x".repeat(900) } });
    expect(out.headline.fa).toBe("b سلام /b دنیا");
    expect(out.headline.fa).not.toMatch(/[<>\u0000]/);
    expect(out.headline.en.length).toBe(120);
  });

  it("caps lists, drops empty items, and coerces unknown chat roles", () => {
    const out = normalizeVpPage({
      chat: [
        { role: "doctor", text: { fa: "یک", en: "one" } },
        { role: "patient", text: { fa: "", en: "" } },
        ...Array.from({ length: 12 }, (_, i) => ({ role: "patient", text: { fa: `خط ${i}`, en: `line ${i}` } })),
      ],
      vitals: Array.from({ length: 9 }, (_, i) => ({ label: { fa: `ع${i}` }, value: `${i}` })),
      faq: [{ q: { fa: "" }, a: { fa: "پاسخ" } }],
    });
    expect(out.chat).toHaveLength(VP_PAGE_LIMITS.chat);
    expect(out.chat[0]).toEqual({ role: "student", text: { fa: "یک", en: "one" } });
    expect(out.vitals).toHaveLength(VP_PAGE_LIMITS.vitals);
    expect(out.faq).toEqual([]);
  });

  it("keeps an explicit empty list (the admin removed every item) instead of restoring defaults", () => {
    expect(normalizeVpPage({ features: [] }).features).toEqual([]);
  });

  it("treats the page switch as a strict boolean", () => {
    expect(normalizeVpPage({ enabled: "yes" }).enabled).toBe(false);
    expect(normalizeVpPage({ enabled: true }).enabled).toBe(true);
    expect(normalizeVpPage({}).enabled).toBe(true);
  });
});

describe("/VP page API", () => {
  it("serves the public copy without auth, with a short cache", async () => {
    const r = await request(app).get("/api/site-content/vp-page");
    expect(r.status).toBe(200);
    expect(r.body.config.headline.fa).toBe(DEFAULT_VP_PAGE.headline.fa);
    expect(r.headers["cache-control"]).toContain("max-age=60");
    expect(r.body.config).not.toHaveProperty("password");
  });

  it("rejects anonymous and learner access to the admin copy", async () => {
    expect((await request(app).get("/api/admin/vp-page")).status).toBe(401);
    const learner = (await login("40012345")).body.token;
    expect((await request(app).get("/api/admin/vp-page").set(A(learner))).status).toBe(403);
    const put = await request(app).put("/api/admin/vp-page").set(A(learner)).send({ config: { enabled: false } });
    expect(put.status).toBe(403);
    expect((await request(app).get("/api/site-content/vp-page")).body.config.enabled).toBe(true);
  });

  it("lets a university content manager read the copy and its limits", async () => {
    const teacher = (await login("teacher")).body.token;
    const r = await request(app).get("/api/admin/vp-page").set(A(teacher));
    expect(r.status).toBe(200);
    expect(r.body.limits).toEqual(VP_PAGE_LIMITS);
    expect(r.body.defaults).toEqual(DEFAULT_VP_PAGE);
  });

  it("saves sanitized copy, serves it publicly, and records the change in the audit log", async () => {
    const admin = (await login("admin")).body.token;
    const hostile = { ...DEFAULT_VP_PAGE, headline: { fa: "<img src=x onerror=alert(1)>عنوان", en: "Title" }, enabled: true };
    const put = await request(app).put("/api/admin/vp-page").set(A(admin)).send({ config: hostile });
    expect(put.status).toBe(200);
    expect(put.body.config.headline.fa).not.toContain("<");
    const pub = await request(app).get("/api/site-content/vp-page");
    expect(pub.body.config.headline).toEqual(put.body.config.headline);
    const row = db.prepare("SELECT action, resource FROM audit_log WHERE action='vp_page.update' ORDER BY id DESC LIMIT 1").get();
    expect(row).toEqual({ action: "vp_page.update", resource: "vp_page" });
  });

  it("falls back to the defaults when the stored value is corrupt", async () => {
    db.prepare("INSERT INTO settings (key,value) VALUES ('vp_page','{not json') ON CONFLICT(key) DO UPDATE SET value=excluded.value").run();
    const r = await request(app).get("/api/site-content/vp-page");
    expect(r.status).toBe(200);
    expect(r.body.config).toEqual(DEFAULT_VP_PAGE);
  });

  it("can switch the page off and back on", async () => {
    const admin = (await login("admin")).body.token;
    await request(app).put("/api/admin/vp-page").set(A(admin)).send({ config: { enabled: false } });
    expect((await request(app).get("/api/site-content/vp-page")).body.config.enabled).toBe(false);
    await request(app).put("/api/admin/vp-page").set(A(admin)).send({ config: { enabled: true } });
    expect((await request(app).get("/api/site-content/vp-page")).body.config.enabled).toBe(true);
  });
});
