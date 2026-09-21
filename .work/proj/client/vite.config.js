import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/* Production build is tuned for fast first paint + cache-friendly chunks:
   - React/ReactDOM live in a stable `react-vendor` chunk so app changes don't
     invalidate the (large) framework download on repeat visits.
   - Page components are code-split via React.lazy in App.jsx (each page = its
     own chunk), so learners never download the admin bundle and vice-versa.
   - Target modern browsers to ship less transpiled/polyfilled code. */
export default defineConfig({
  plugins: [react()],
  // Drop console.* / debugger in the production build (smaller + cleaner).
  esbuild: { drop: ["console", "debugger"] },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
  build: {
    target: "es2020",
    cssTarget: "chrome100",
    chunkSizeWarningLimit: 700,
    // Strip console.* and debugger from the production bundle for a smaller,
    // faster download (and no dev noise leaking to users). esbuild is the
    // default minifier — fast and effective.
    minify: "esbuild",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            // Keep the React runtime in one long-lived, cacheable chunk.
            if (id.includes("/react-dom/") || id.includes("/react/") || id.includes("/scheduler/")) {
              return "react-vendor";
            }
            // Fonts are imported as CSS and emitted as assets, not JS — no chunk.
            return "vendor";
          }
        },
      },
    },
  },
});
