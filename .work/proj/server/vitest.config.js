import { defineConfig } from "vitest/config";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// R55: the suite seeds the database (`seed.js --force`) and writes to DATA_DIR.
// Without this, a test run wiped the developer's live medlab.db. Each run gets its
// own scratch data directory unless the caller sets DATA_DIR explicitly.
const testDataDir = process.env.DATA_DIR || fs.mkdtempSync(path.join(os.tmpdir(), "med-vitest-data-"));

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.js"],
    testTimeout: 20000,
    fileParallelism: false, // shared SQLite/app
    // The suite fires many requests from one "IP"; disable rate limiting by
    // default. The dedicated security test flips this env per-request to verify
    // the limiter actually engages.
    // Legacy/offline regressions explicitly exercise diagnostic mode; the
    // vp-required-ai suite separately enables and tests the production default.
    env: { DISABLE_RATE_LIMIT: "1", VP_REQUIRE_AI_EVALUATION: "0", DATA_DIR: testDataDir },
  },
});
