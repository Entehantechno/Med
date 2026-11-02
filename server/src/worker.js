/* ================================================================
   worker.js — one HTTP worker process (WEB_CONCURRENCY > 1).

   The primary (index.js) boots the database once: validation, upgrade snapshot,
   migrations, seeding, scheduled jobs. It then starts this file N-1 times. Each
   worker opens its own SQLite connection and serves the same app. Connections are
   spread across processes by the kernel (SO_REUSEPORT). Shared state (rate
   counters, login backoff, job leases) lives in the database, so every process
   enforces the same limits.

   A worker exits when the primary goes away (IPC disconnect), so no orphans remain.
   ================================================================ */
import "./lib/node-version.js";
import "./load-env.js";
import http from "http";
import { initDb } from "./db.js";
import { createApp } from "./app.js";

const PORT = Number(process.env.PORT) || 4000;

await initDb({ worker: true });
const app = createApp();
const server = http.createServer(app);
// Same protections as the primary (index.js): slowloris and idle-socket limits.
server.requestTimeout = 60_000;
server.headersTimeout = 65_000;
server.keepAliveTimeout = 30_000;
server.on("error", (err) => {
  console.error(`[worker ${process.pid}] server error:`, err?.stack || err);
  process.exit(1);
});
server.listen({ port: PORT, reusePort: true }, () => {
  console.log(`[worker ${process.pid}] serving on port ${PORT}`);
});

process.on("disconnect", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));
