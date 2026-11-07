import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.js"],
    include: ["src/**/*.test.{js,jsx}"],
    // The live smoke needs a running server on :4000 (see file header); run it
    // explicitly: `npx vitest run src/test/smoke.live.test.jsx`.
    exclude: ["**/node_modules/**", "**/dist/**", "src/test/smoke.live.test.jsx"],
  },
});
