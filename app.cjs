/* app.cjs — cPanel / Passenger startup file (set this as "Application startup file").

   WHY THIS FILE EXISTS
   Phusion Passenger (cPanel "Setup Node.js App") loads the startup file with
   require(). This project is native ES-modules ("type": "module"), so pointing
   Passenger straight at server/src/index.js fails with
   ERR_REQUIRE_ESM → the app never starts and the domain shows a 503 / blank
   page, with the only clue buried in ~/medschool/stderr.log.
   A .cjs file is always CommonJS, and a dynamic import() from CommonJS is the
   officially supported bridge — so this shim is the one file Passenger can
   load on every Node version (16/18/20/22).

   Also works with: `node app.cjs`, pm2, systemd, Docker. */
"use strict";
const path = require("path");
// Passenger may start us with an arbitrary cwd; relative paths (data dir,
// .env, client/dist) are resolved by the server from its own file location,
// but chdir keeps any leftover relative lookups sane too.
try { process.chdir(__dirname); } catch { /* read-only fs — fine */ }
import(path.join(__dirname, "server", "src", "index.js")).catch((err) => {
  console.error("[MED School] failed to start:", err && err.stack || err);
  // Passenger treats a fast exit as a crash and shows its own error page —
  // keep the loop alive briefly so the real reason lands in stderr.log first.
  setTimeout(() => process.exit(1), 2000);
});
