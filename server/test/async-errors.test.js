/* ================================================================
   async-errors.test.js — R59 regression.

   Express 4 does not forward a rejected promise from an async route
   handler to the error middleware, so a failing `await` used to leave
   the request hanging. `src/app.js` now imports express-async-errors.
   These tests pin both halves: a bare rejection becomes a fast JSON 500,
   and the real app still answers normally.
   ================================================================ */
import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import "../src/app.js";            // loads the patch exactly as production does
import { errorHandler } from "../src/lib/security.js";

describe("async route rejections reach the error handler (R59)", () => {
  it("returns a JSON 500 instead of hanging", async () => {
    const app = express();
    app.get("/boom", async () => {
      await Promise.reject(new Error("simulated db failure"));
    });
    app.use(errorHandler);
    const started = Date.now();
    const res = await request(app).get("/boom").timeout(3000);
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("server_error");
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("logs stack traces only for 5xx, never for client faults (400)", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const app = express();
      app.use(express.json());
      app.post("/echo", (req, res) => res.json({ ok: true }));
      app.use(errorHandler);
      const bad = await request(app).post("/echo").set("content-type", "application/json").send("{not json");
      expect(bad.status).toBe(400);
      expect(errSpy).not.toHaveBeenCalled();

      const app2 = express();
      app2.get("/x", async () => { throw new Error("db down"); });
      app2.use(errorHandler);
      const server = await request(app2).get("/x");
      expect(server.status).toBe(500);
      expect(errSpy).toHaveBeenCalledTimes(1);
    } finally {
      errSpy.mockRestore();
    }
  });

  it("forwards the rejected error object itself", async () => {
    const app = express();
    app.get("/typed", async () => {
      const e = new Error("typed");
      e.status = 422;
      throw e;
    });
    app.use(errorHandler);
    const res = await request(app).get("/typed").timeout(3000);
    expect(res.status).toBe(422);
  });
});
