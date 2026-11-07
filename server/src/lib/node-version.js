/* ================================================================
   node-version.js — refuse to start on a Node.js that cannot load
   the database engine (R71).

   better-sqlite3 13.x ships prebuilt binaries built against Node-API
   version 10. Node 22 provides Node-API 10 only from 22.14.0 (23.6.0 and
   later, and every 24.x). On Node 22.0–22.13 the binary fails to load
   with a long, unhelpful error, so we stop first with a clear message.
   This module is imported first in index.js, so it runs before db.js
   loads the native addon.
   ================================================================ */
const [major, minor] = process.versions.node.split(".").map((n) => parseInt(n, 10));
const supported =
  major >= 24 ||
  (major === 23 && minor >= 6) ||
  (major === 22 && minor >= 14);

if (!supported) {
  console.error(
    `[startup] Node.js ${process.versions.node} is too old for MED School. ` +
    `Install Node.js 22.14 or newer (or 24.x) from https://nodejs.org/ and start the server again.`
  );
  process.exit(1);
}
