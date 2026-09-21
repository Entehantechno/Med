/* ================================================================
   order-catalog.test.js — shared VP lab/imaging option list.
   ================================================================ */
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import request from "supertest";
import { initDb } from "../src/db.js";
import { createApp } from "../src/app.js";

let app;
const login = (u, p = "demo") => request(app).post("/api/auth/login").send({ username: u, password: p });
async function token(u, p = "demo") { return (await login(u, p)).body.token; }
const A = (tk) => ({ Authorization: `Bearer ${tk}` });

beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb();
  app = createApp();
});

describe("VP order catalog", () => {
  it("students and teachers get the seeded lab + imaging options", async () => {
    const stk = await token("40012345");
    const ttk = await token("teacher");
    const student = await request(app).get("/api/order-catalog").set(A(stk));
    const teacher = await request(app).get("/api/order-catalog").set(A(ttk));
    expect(student.status).toBe(200);
    expect(teacher.status).toBe(200);
    expect(student.body.labs.length).toBeGreaterThan(5);
    expect(student.body.imaging.length).toBeGreaterThan(5);
    expect(student.body.labs.some((x) => /CBC/i.test(x.en) || /CBC/.test(x.fa))).toBe(true);
    expect(teacher.body.labs.length).toBe(student.body.labs.length);
  });

  it("teacher can add and remove options; student then sees the same list", async () => {
    const ttk = await token("teacher");
    const before = (await request(app).get("/api/order-catalog").set(A(ttk))).body;
    const labs = [...before.labs, { fa: "تست اختصاصی کیس", en: "Case-specific assay", aliases: ["csa"] }];
    const imaging = before.imaging.filter((_, i) => i !== 0);
    const put = await request(app).put("/api/order-catalog").set(A(ttk)).send({ labs, imaging });
    expect(put.status).toBe(200);
    expect(put.body.labs.some((x) => x.en === "Case-specific assay")).toBe(true);
    expect(put.body.imaging.length).toBe(imaging.length);

    const stk = await token("40012345");
    const seen = await request(app).get("/api/order-catalog").set(A(stk));
    expect(seen.status).toBe(200);
    expect(seen.body.labs.some((x) => x.en === "Case-specific assay")).toBe(true);
    expect(seen.body.imaging.length).toBe(imaging.length);
  });

  it("students cannot rewrite the catalog; empty lists are rejected", async () => {
    const stk = await token("40012345");
    const denied = await request(app).put("/api/order-catalog").set(A(stk))
      .send({ labs: [{ fa: "x", en: "x" }], imaging: [{ fa: "y", en: "y" }] });
    expect(denied.status).toBe(403);
    const ttk = await token("teacher");
    const empty = await request(app).put("/api/order-catalog").set(A(ttk)).send({ labs: [], imaging: [] });
    expect(empty.status).toBe(400);
  });
});
