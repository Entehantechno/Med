/* stamp-sw.mjs — after `vite build`, replace the __BUILD_VERSION__ token in the
   built service worker (dist/sw.js) with the app's real VERSION.txt value.

   Why: the SW's CACHE_VERSION must change every release so old caches are
   cleaned on activate — otherwise learners keep seeing stale (cached) pages
   even after an update. This makes cache invalidation automatic + reliable. */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");           // repo root (has VERSION.txt)
const swPath = join(__dirname, "..", "dist", "sw.js");

function version() {
  try {
    const v = readFileSync(join(root, "VERSION.txt"), "utf8").trim();
    if (v) return v.replace(/[^a-zA-Z0-9._-]/g, "");
  } catch { /* fall through */ }
  // fallback: a timestamp so the cache still changes on every build
  return "dev-" + new Date().toISOString().slice(0, 16).replace(/[:T-]/g, "");
}

if (!existsSync(swPath)) {
  console.warn("[stamp-sw] dist/sw.js not found — skipping");
  process.exit(0);
}
const v = version();
let src = readFileSync(swPath, "utf8");
src = src.replaceAll("__BUILD_VERSION__", v);
writeFileSync(swPath, src);
console.log(`[stamp-sw] service worker cache version → medschool-${v}`);
