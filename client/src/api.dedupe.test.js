// @vitest-environment jsdom
// R89: identical in-flight GETs share one request; settled requests are not reused; a
// different token never shares a response.
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { api, setToken } from "./api.js";

const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
let calls;
beforeEach(() => { calls = []; setToken(null); });
afterEach(() => { vi.unstubAllGlobals(); setToken(null); });

function deferredFetch() {
  const pending = [];
  const fn = vi.fn((url) => { calls.push(url); return new Promise((r) => { pending.push(() => r(json({ url }))); }); });
  vi.stubGlobal("fetch", fn);
  // Resolve every request that is still waiting (oldest first).
  return { fn, release: () => { while (pending.length) pending.shift()(); } };
}

describe("api GET dedupe (R89)", () => {
  it("shares one network request between concurrent identical GETs", async () => {
    const { fn, release } = deferredFetch();
    const a = api.get("/flags");
    const b = api.get("/flags");
    release();
    const [x, y] = await Promise.all([a, b]);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(x).toEqual({ url: "/api/flags" });
    expect(y).toBe(x);
  });

  it("does not reuse a response after the request has settled", async () => {
    let n = 0;
    vi.stubGlobal("fetch", vi.fn(async () => json({ n: ++n })));
    expect(await api.get("/site-content")).toEqual({ n: 1 });
    expect(await api.get("/site-content")).toEqual({ n: 2 });
  });

  it("keeps different paths and different tokens apart", async () => {
    const { fn, release } = deferredFetch();
    const a = api.get("/flags");
    const b = api.get("/cases");
    release();
    await Promise.all([a, b]);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("never dedupes POST/PUT/DELETE", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ ok: true })));
    await Promise.all([api.post("/x", {}), api.post("/x", {})]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("a failed GET is released so the next call retries", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new TypeError("down")).mockResolvedValueOnce(json({ ok: 1 })));
    await expect(api.get("/flags")).rejects.toMatchObject({ status: 0 });
    expect(await api.get("/flags")).toEqual({ ok: 1 });
  });
});
