/* Persian (۰-۹), Arabic-Indic (٠-٩) and ASCII digits are the same digits for login.
   A student's number is stored in ASCII and is also the initial password (admin.js).
   Legacy rows saved with Persian digits must still log in with any digit set. */
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import request from "supertest";
import { createApp } from "../src/app.js";
import { initDb, persistNow, db } from "../src/db.js";
import { hashPassword } from "../src/lib/password.js";
import { normalizeAccountDigits } from "../src/lib/digits.js";
import { passwordRejected } from "../src/routes/auth.js";

let app;
const login = (u, p) => request(app).post("/api/auth/login").send({ username: u, password: p });
const A = (tk) => ({ Authorization: `Bearer ${tk}` });

beforeAll(async () => {
  execSync("node src/seed.js --force", { cwd: process.cwd(), stdio: "ignore" });
  await initDb();
  app = createApp();
});

describe("account digits: Persian, Arabic-Indic and ASCII are interchangeable at login", () => {
  it("a student created with Persian digits logs in with ASCII, Persian, Arabic-Indic and mixed input", async () => {
    const atk = (await login("admin", "demo")).body.token;
    const made = await request(app).post("/api/admin/users").set(A(atk))
      .send({ role: "student", name_fa: "ارقام فارسی", student_no: "۴۰۰۱۱۲۲۴", university_id: 1 });
    expect(made.status).toBe(200);
    const row = db.prepare("SELECT username, student_no FROM users WHERE id=?").get(made.body.id);
    expect(row.username).toBe("40011224");           // stored ASCII
    expect(row.student_no).toBe("40011224");

    expect((await login("40011224", "40011224")).status).toBe(200);     // ASCII / ASCII
    expect((await login("۴۰۰۱۱۲۲۴", "۴۰۰۱۱۲۲۴")).status).toBe(200);      // Persian / Persian
    expect((await login("٤٠٠١١٢٢٤", "٤٠٠١١٢٢٤")).status).toBe(200);      // Arabic-Indic / Arabic-Indic
    expect((await login("۴۰۰۱۱۲۲۴", "40011224")).status).toBe(200);      // Persian user, ASCII password
  });

  it("a wrong number is still rejected in every digit set", async () => {
    expect((await login("40011225", "40011225")).status).toBe(401);
    expect((await login("۴۰۰۱۱۲۲۵", "۴۰۰۱۱۲۲۵")).status).toBe(401);
    expect((await login("40011224", "40011225")).status).toBe(401);
  });

  it("legacy row with Persian username and a Persian-digit password hash still logs in with ASCII digits", async () => {
    const atk = (await login("admin", "demo")).body.token;
    const made = await request(app).post("/api/admin/users").set(A(atk))
      .send({ role: "student", name_fa: "قدیمی", student_no: "5556667", university_id: 1 });
    expect(made.status).toBe(200);
    // simulate a row written before normalisation: Persian username, hash of the Persian spelling
    db.prepare("UPDATE users SET username=?, student_no=?, password_hash=? WHERE id=?")
      .run("۵۵۵۶۶۶۷", "۵۵۵۶۶۶۷", await hashPassword("۵۵۵۶۶۶۷"), made.body.id);
    persistNow();
    // the same one-time normalisation the server runs on every boot (index.js)
    const fixed = normalizeAccountDigits(db);
    expect(fixed.usernames).toBe(1);
    expect(db.prepare("SELECT username FROM users WHERE id=?").get(made.body.id).username).toBe("5556667");
    expect((await login("5556667", "5556667")).status).toBe(200);     // ASCII input
    expect((await login("۵۵۵۶۶۶۷", "۵۵۵۶۶۶۷")).status).toBe(200);     // Persian input
    expect((await login("5556667", "۵۵۵۶۶۶۷")).status).toBe(200);     // ASCII user, Persian password
    expect((await login("5556668", "5556668")).status).toBe(401);
  });

  it("the common-password rule judges Persian and Arabic-Indic digits like ASCII", () => {
    expect(passwordRejected("12345678")).toBe("common");
    expect(passwordRejected("۱۲۳۴۵۶۷۸")).toBe("common");
    expect(passwordRejected("١٢٣٤٥٦٧٨")).toBe("common");
    expect(passwordRejected("۸۷۶۵۴۳۲۱")).toBe(null);     // not a common password, still accepted
  });

  it("self-service password change rejects a common password typed with Persian digits", async () => {
    const ltk = (await login("learner", "demo")).body.token;
    const common = await request(app).put("/api/auth/password").set(A(ltk))
      .send({ currentPassword: "demo", newPassword: "۱۲۳۴۵۶۷۸" });
    expect(common.status).toBe(400);
    expect(common.body.error).toBe("password_too_common");
  });

  it("breached-password check runs on the ASCII spelling in sign-up, self-service change and admin reset", async () => {
    const { readFileSync } = await import("node:fs");
    const authSrc = readFileSync(new URL("../src/routes/auth.js", import.meta.url), "utf8");
    const adminSrc = readFileSync(new URL("../src/routes/admin.js", import.meta.url), "utf8");
    expect(authSrc).toContain("passwordPwned(toAsciiDigits(String(password)))");
    expect(authSrc).toContain("passwordPwned(toAsciiDigits(String(newPassword)))");
    expect(adminSrc).toContain("passwordPwned(pw)");
  });
});
