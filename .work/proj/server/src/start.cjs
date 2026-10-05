/* start.cjs — CommonJS shim for hosts (cPanel/Passenger) that require() the
   startup file. See ../../app.cjs (the recommended entry) for the full story. */
"use strict";
import("./index.js").catch((err) => {
  console.error("[MED School] failed to start:", err && err.stack || err);
  setTimeout(() => process.exit(1), 2000);
});
