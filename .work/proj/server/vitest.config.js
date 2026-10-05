import { defineConfig } from "vitest/config";

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
    env: { DISABLE_RATE_LIMIT: "1", VP_REQUIRE_AI_EVALUATION: "0" },
  },
});
