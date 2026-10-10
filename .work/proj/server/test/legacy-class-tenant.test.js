/* R50: classes with no university (legacy rows) belong to the default university (id 1).
   The list queries use COALESCE(university_id,1); the boot migration also backfills them. */
import { describe, it, expect, beforeAll } from "vitest";
import { execSync, execFileSync } from "child_process";
import request from "supertest";
import { createApp } from "../src/app.js";
import { initDb, persistNow, db } from "../src/db.js";

let app;
const login = (u, p = "demo") => request(app).post("/api/auth/login").send({ username: u, password: p });
async function token(u, p = "demo") { return (await login(u, p)).body.token; }
const A = (tk) => ({ Authorization: `Bearer ${tk}` });

beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb();
  app = createApp();
});

describe("legacy classes without university_id", () => {
  it("a teacher of the default university still sees a class whose university_id is NULL", async () => {
    const ttk = await token("teacher");
    const cls = await request(app).post("/api/classes").set(A(ttk))
      .send({ name_fa: "کلاس قدیمی", name_en: "legacy class", maxAttempts: 2 });
    expect(cls.status).toBe(200);
    db.prepare("UPDATE classes SET university_id=NULL WHERE id=?").run(cls.body.id);
    const list = await request(app).get("/api/classes").set(A(ttk));
    expect(list.status).toBe(200);
    const rows = Array.isArray(list.body) ? list.body : (list.body.classes || []);
    expect(rows.some((c) => c.id === cls.body.id)).toBe(true);
  });

  it("the boot migration assigns NULL rows to university 1 (fresh process, same DB file)", async () => {
    const id = db.prepare("SELECT id FROM classes ORDER BY id DESC LIMIT 1").get().id;
    db.prepare("UPDATE classes SET university_id=NULL WHERE id=?").run(id);
    persistNow();
    // schemaReady is process-wide, so the real boot path is exercised in a child process.
    const out = execFileSync(process.execPath, ["--input-type=module", "-e",
      `const m = await import("./src/db.js"); await m.initDb(); m.initSchema();
       console.log("UNI=" + m.db.prepare("SELECT university_id u FROM classes WHERE id=?").get(${id}).u);`],
      { cwd: process.cwd(), env: process.env, encoding: "utf8" });
    expect(out).toContain("UNI=1");
  });
});
