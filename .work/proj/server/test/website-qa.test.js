import { describe, it, expect } from "vitest";
import { readFileSync, statSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

describe("website QA — copy, a11y markers, login UX", () => {
  it("keeps learner-facing i18n free of Arabic Yeh/Kaf and ends with biField", () => {
    const i18n = read("client/src/i18n.js");
    expect(i18n).not.toMatch(/\u064a/);
    expect(i18n).not.toMatch(/\u0643/);
    expect(i18n).toMatch(/export function biField/);
    expect(i18n.trim().split("\n").slice(-6).join("\n")).toMatch(/export function biField/);
    expect(i18n).toMatch(/اولین درس را همین امروز بزن/);
    expect(i18n).toMatch(/checkAns: "بررسی پاسخ"/);
    expect(i18n).toMatch(/Learn, compete, and climb the national ranking/);
  });

  it("shows Google sign-in once on the login card (not duplicated under the form)", () => {
    const login = read("client/src/pages/Login.jsx");
    const buttons = login.match(/<GoogleButton/g) || [];
    expect(buttons).toHaveLength(1);
    expect(login).toMatch(/aria-labelledby="login-title"/);
    expect(login).toMatch(/id="login-title"/);
  });

  it("exposes skip-to-content on landing and the learner shell", () => {
    const landing = read("client/src/pages/Landing.jsx");
    const app = read("client/src/pages/learn/LearnApp.jsx");
    expect(landing).toMatch(/skip-link/);
    expect(landing).toMatch(/#main-content/);
    expect(landing).toMatch(/aria-label=\{fa \? \(theme === "light"/);
    expect(app).toMatch(/skip-link/);
    expect(app).toMatch(/#learn-main/);
    expect(app).toMatch(/id="learn-main"/);
  });

  it("lets the learner check an MCQ with Enter after picking an option", () => {
    const lesson = read("client/src/pages/learn/Lesson.jsx");
    expect(lesson).toMatch(/e\.key === "Enter"/);
    expect(lesson).toMatch(/sel != null/);
    expect(lesson).toMatch(/role="progressbar"/);
    expect(lesson).toMatch(/lesson-cta \.btn-accent/);
    expect(lesson).toMatch(/طرح آموزشی سؤال/);
  });

  it("does not ship obvious secrets in client source", () => {
    const login = read("client/src/pages/Login.jsx");
    const google = read("client/src/components/GoogleButton.jsx");
    expect(login).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
    expect(google).not.toMatch(/BEGIN PRIVATE KEY/);
    expect(google).toMatch(/use_fedcm_for_prompt/);
  });

  it("ships official booklet films and teaching diagrams", () => {
    const admin = read("server/src/routes/admin.js");
    expect(admin).toMatch(/media: q\.micro\.media/);
    expect(admin).toMatch(/image: q\.image/);
    for (const f of [
      "server/uploads/booklet-1403-q111-lbo.jpg",
      "server/uploads/booklet-1403-q128-elbow.jpg",
      "server/uploads/booklet-1403-q178-pedigree.png",
      "server/uploads/booklet-1402-q180-pedigree.png",
      "server/uploads/booklet-1402-q59-ea.jpg",
      "server/uploads/teach-tnm.svg",
    ]) {
      expect(statSync(join(root, f)).size).toBeGreaterThan(200);
    }
  });
});
