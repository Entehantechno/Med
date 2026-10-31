// Round 64: /flags is fetched once per signed-in session, and again after a sign-in that
// follows a sign-out or a failed request. A returning visitor's request starts at mount.
import { it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, act, cleanup } from "@testing-library/react";

const h = vi.hoisted(() => ({ token: null, get: null, me: null, login: null }));
vi.mock("../api.js", () => {
  const api = {
    get: (...a) => h.get(...a),
    post: () => Promise.resolve({}),
    me: (...a) => h.me(...a),
    login: (...a) => h.login(...a),
    register: () => Promise.resolve({}),
    put: () => Promise.resolve({}),
    del: () => Promise.resolve({}),
  };
  return {
    api,
    getToken: () => h.token,
    setToken: (t) => { h.token = t; },
    loadFailKind: () => "server",
    loadFailText: () => "",
  };
});

const STUDENT = { id: 7, role: "student", username: "s7", name_en: "S", name_fa: "س" };
const flagCalls = () => h.get.mock.calls.filter((c) => c[0] === "/flags").length;

let app = null;
let AppProvider = null;
let useApp = null;
function Probe() {
  app = useApp();
  return null;
}

async function boot() {
  const mod = await import("../context.jsx");
  AppProvider = mod.AppProvider;
  useApp = mod.useApp;
  render(<AppProvider><Probe /></AppProvider>);
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

beforeEach(() => {
  cleanup();
  app = null;
  h.token = null;
  h.get = vi.fn(() => Promise.resolve({ flags: { store: true } }));
  h.me = vi.fn(() => Promise.resolve({ user: STUDENT }));
  h.login = vi.fn(() => Promise.resolve({ token: "t-login", user: STUDENT }));
});

it("a returning visitor fetches flags once, at mount, not again after /auth/me", async () => {
  h.token = "t-saved";
  await boot();
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  expect(h.me).toHaveBeenCalled();
  expect(app.user?.id).toBe(7);
  expect(flagCalls()).toBe(1);
});

it("a first-time visitor fetches no flags until sign-in, then once", async () => {
  await boot();
  expect(flagCalls()).toBe(0);
  await act(async () => { await app.login("s7", "pw"); });
  expect(app.user?.id).toBe(7);
  expect(flagCalls()).toBe(1);
});

it("sign-out then sign-in fetches flags again for the new session", async () => {
  h.token = "t-saved";
  await boot();
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  expect(flagCalls()).toBe(1);
  act(() => app.logout());
  expect(app.user).toBeNull();
  await act(async () => { await app.login("s7", "pw"); });
  expect(flagCalls()).toBe(2);
});

it("a failed mount-time flags request is retried once the user is known, and the next sign-in fetches again", async () => {
  h.token = "t-saved";
  h.get = vi.fn(() => Promise.reject(new Error("network")));
  await boot();
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  // the failed mount request releases its marker; the restored user triggers one retry
  expect(flagCalls()).toBe(2);
  h.get = vi.fn(() => Promise.resolve({ flags: { store: false } }));
  act(() => app.logout());
  await act(async () => { await app.login("s7", "pw"); });
  expect(flagCalls()).toBe(1);
});
