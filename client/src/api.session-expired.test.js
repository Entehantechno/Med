// @vitest-environment jsdom
// Round 64: when the server closes a timed encounter or run, every screen hears one event
// and finishes from the stored answers.
import { describe, it, expect, vi, afterEach } from "vitest";
import { api } from "./api.js";

afterEach(() => { vi.unstubAllGlobals(); });

const jsonRes = (status, body) => ({
  ok: status >= 200 && status < 300, status,
  headers: new Headers({ "content-type": "application/json" }),
  text: async () => JSON.stringify(body),
  json: async () => body,
});

describe("session_expired broadcast (R64)", () => {
  it("dispatches medlab-session-expired on a 409 session_expired and still throws", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes(409, { error: "session_expired", stage: "session", remainingSec: 0 })));
    const heard = vi.fn();
    window.addEventListener("medlab-session-expired", heard);
    try {
      await expect(api.put("/exam/session-progress", { sessionId: 1, progress: {} })).rejects.toMatchObject({ status: 409 });
      expect(heard).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener("medlab-session-expired", heard);
    }
  });

  it("does not dispatch for other errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes(409, { error: "session_closed", stage: "session" })));
    const heard = vi.fn();
    window.addEventListener("medlab-session-expired", heard);
    try {
      await expect(api.put("/exam/session-progress", { sessionId: 1 })).rejects.toMatchObject({ status: 409 });
      expect(heard).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("medlab-session-expired", heard);
    }
  });
});
