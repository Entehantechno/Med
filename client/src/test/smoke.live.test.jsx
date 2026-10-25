/* Live smoke: render the real app in jsdom against a RUNNING server and click
   through every learner tab + every admin/teacher tab, collecting runtime errors
   (thrown render errors, console.error from React, unhandled rejections).

   Not part of `npm test` (excluded in vitest.config.js). To run:
     1) cd server && DISABLE_RATE_LIMIT=1 PORT=4000 node src/index.js
     2) cd client && npx vitest run src/test/smoke.live.test.jsx
        (SMOKE_LANG=en to exercise the English UI) */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import React from "react";

const BASE = "http://localhost:4000";
const realFetch = globalThis.fetch;
globalThis.fetch = (url, opts) => {
  const u = typeof url === "string" ? url : url.url;
  const abs = u.startsWith("/") ? BASE + u : u;
  return realFetch(abs, opts);
};
// jsdom lacks some browser APIs
if (!window.matchMedia) window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
if (!window.scrollTo) window.scrollTo = () => {};
window.HTMLElement.prototype.scrollIntoView = () => {};
window.HTMLElement.prototype.scrollTo = () => {};
if (!window.ResizeObserver) window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
if (!window.IntersectionObserver) window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
if (!window.requestIdleCallback) window.requestIdleCallback = (cb) => setTimeout(cb, 0);
if (!URL.createObjectURL) URL.createObjectURL = () => "blob:x";
HTMLCanvasElement.prototype.getContext = () => ({ fillRect() {}, clearRect() {}, getImageData: () => ({ data: [] }), putImageData() {}, createImageData: () => [], setTransform() {}, drawImage() {}, save() {}, fillText() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, translate() {}, scale() {}, rotate() {}, arc() {}, fill() {}, measureText: () => ({ width: 0 }), transform() {}, rect() {}, clip() {} });

const errors = [];
const origError = console.error;
console.error = (...a) => {
  const s = a.map((x) => (x && x.stack) || String(x)).join(" ");
  if (/act\(|not wrapped in act|Warning: |ReactDOMTestUtils/.test(s)) return;
  errors.push(s.slice(0, 400));
};
window.addEventListener("error", (e) => errors.push("window.error: " + (e.error?.stack || e.message)));
window.addEventListener("unhandledrejection", (e) => errors.push("unhandledrejection: " + (e.reason?.stack || e.reason)));
process.on("unhandledRejection", (r) => errors.push("node unhandledRejection: " + (r?.stack || r)));

async function login(username) {
  const r = await realFetch(BASE + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password: "demo" }) });
  const j = await r.json();
  if (!j.token) throw new Error("login failed " + username + " " + JSON.stringify(j));
  return j.token;
}
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const wait = async (ms) => { await act(async () => { await sleep(ms / 2); }); await sleep(ms / 2); await act(async () => {}); };
const settle = async (max = 8000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < max) { await wait(200); if (!document.querySelector(".route-fallback")) return; }
};

async function mountApp() {
  const { AppProvider } = await import("./context.jsx");
  const { default: App } = await import("./App.jsx");
  const { default: ErrorBoundary } = await import("./components/ErrorBoundary.jsx");
  const utils = render(<ErrorBoundary><AppProvider><App /></AppProvider></ErrorBoundary>);
  await settle(); await wait(800);
  return utils;
}

function snapshotErrors(label) {
  const mine = errors.splice(0);
  if (mine.length) console.log(`\n### ${label}: ${mine.length} error(s)\n` + mine.map((e) => " - " + e.split("\n").slice(0, 4).join("\n   ")).join("\n"));
  return mine;
}

const report = {};

describe("live smoke", () => {
  beforeAll(() => { localStorage.setItem("medlab_lang", process.env.SMOKE_LANG || "fa"); });

  it("public landing / login / blog / store", async () => {
    localStorage.removeItem("medlab_token");
    await mountApp();
    report.landing = snapshotErrors("landing");
    cleanup();
    for (const path of ["/blog", "/store", "/verify/MED-2026-DEMO01", "/login"]) {
      window.history.replaceState({}, "", path);
      await mountApp();
      report["public" + path] = snapshotErrors("public " + path);
      cleanup();
    }
    window.history.replaceState({}, "", "/");
  }, 120000);

  it("learner: every tab", async () => {
    localStorage.setItem("medlab_token", await login("learner"));
    const u = await mountApp();
    report.learnerHome = snapshotErrors("learner home");
    const navBtns = [...document.querySelectorAll(".nav-item")];
    console.log("learner nav buttons:", navBtns.length);
    const seen = new Set();
    for (let i = 0; i < navBtns.length; i++) {
      const b = [...document.querySelectorAll(".nav-item")][i]; if (!b) continue;
      const key = (b.textContent || "").trim(); if (seen.has(key)) continue; seen.add(key);
      await act(async () => { fireEvent.click(b); });
      await settle(); await wait(900);
      // also click the first few in-page buttons that look like "start" actions
      const e = snapshotErrors("learner tab " + key);
      if (e.length) report["learner:" + key] = e;
    }
    console.log("learner tabs visited:", seen.size);
    cleanup();
  }, 300000);

  it("admin: every tab", async () => {
    localStorage.setItem("medlab_token", await login("admin"));
    window.history.replaceState({}, "", "/admin");
    await mountApp();
    for (let i = 0; i < 20 && !document.querySelector(".nav-tab-btn"); i++) await wait(500);
    console.log("admin mounted, nav buttons:", document.querySelectorAll(".nav-tab-btn").length, document.body.textContent.slice(0, 200));
    report.adminHome = snapshotErrors("admin home");
    const seen = new Set();
    for (let round = 0; round < 3; round++) {
      const modeBtns = [...document.querySelectorAll(".mode-switch button")];
      console.log("mode buttons:", modeBtns.length, modeBtns.map((b) => b.textContent.trim()).join("|"));
      if (modeBtns[round]) { await act(async () => { fireEvent.click(modeBtns[round]); }); await wait(600); }
      console.log("round", round, "nav count", document.querySelectorAll(".nav-tab-btn").length);
      const n = document.querySelectorAll(".nav-tab-btn").length;
      for (let i = 0; i < n; i++) {
        const b = [...document.querySelectorAll(".nav-tab-btn")][i]; if (!b) continue;
        const key = round + ":" + (b.textContent || "").trim();
        if (seen.has(key)) continue; seen.add(key);
        await act(async () => { fireEvent.click(b); });
        await settle(); await wait(900);
        // exercise in-page sub tabs (pills/tabs) too
        const subs = [...document.querySelectorAll("main .tabs button, main .pill, main .subtab, main .seg button, main .segmented button, main [role=tab]")].slice(0, 12);
        for (const sb of subs) { try { await act(async () => { fireEvent.click(sb); }); await wait(300); } catch (e) { errors.push("subtab click: " + (e.stack || e)); } }
        const e = snapshotErrors("admin tab " + key);
        if (e.length) report["admin:" + key] = e;
      }
    }
    console.log("admin tabs visited:", seen.size);
    cleanup();
  }, 600000);

  it("teacher: every admin tab", async () => {
    localStorage.setItem("medlab_token", await login("teacher"));
    window.history.replaceState({}, "", "/admin");
    await mountApp();
    for (let i = 0; i < 20 && !document.querySelector(".nav-tab-btn"); i++) await wait(500);
    const seen = new Set();
    for (let round = 0; round < 3; round++) {
      const modeBtns = [...document.querySelectorAll(".mode-switch button")];
      if (modeBtns[round]) { await act(async () => { fireEvent.click(modeBtns[round]); }); await wait(600); }
      const n = document.querySelectorAll(".nav-tab-btn").length;
      for (let i = 0; i < n; i++) {
        const b = [...document.querySelectorAll(".nav-tab-btn")][i]; if (!b) continue;
        const key = round + ":" + (b.textContent || "").trim(); if (seen.has(key)) continue; seen.add(key);
        await act(async () => { fireEvent.click(b); }); await settle(); await wait(900);
        const e = snapshotErrors("teacher tab " + key); if (e.length) report["teacher:" + key] = e;
      }
    }
    console.log("teacher tabs visited:", seen.size);
    cleanup();
  }, 600000);

  it("student + teacher home", async () => {
    for (const who of ["40012345", "teacher"]) {
      localStorage.setItem("medlab_token", await login(who));
      window.history.replaceState({}, "", who === "teacher" ? "/admin" : "/");
      await mountApp();
      // click every visible nav button once
      const seen = new Set();
      for (const b of [...document.querySelectorAll("button")]) {
        const key = (b.textContent || "").trim(); if (!key || seen.has(key) || key.length > 40) continue; seen.add(key);
        await act(async () => { fireEvent.click(b); }); await wait(300);
        const e = snapshotErrors(`${who} click ${key}`); if (e.length) report[`${who}:${key}`] = e;
      }
      snapshotErrors(who + " home");
      cleanup();
    }
    console.log("\n==== SUMMARY ====\n" + JSON.stringify(Object.fromEntries(Object.entries(report).filter(([, v]) => v.length)), null, 1).slice(0, 8000));
    expect(true).toBe(true);
  }, 300000);
});
