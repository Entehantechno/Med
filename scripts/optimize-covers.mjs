#!/usr/bin/env node
/* R89: build AVIF + WebP siblings for the reference covers (client/public/covers/*.jpg).
   The covers are shown at 180x250 CSS px (360 px for 2x screens), but the originals are
   1024x1536 JPEGs of 140–340 KB each. The originals stay as the fallback.
   Usage: node scripts/optimize-covers.mjs   (needs ImageMagick `convert` with AVIF/WebP support) */
import { execFileSync } from "node:child_process";
import { readdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dir = path.join(root, "client/public/covers");
const WIDTH = 360;
const jobs = [["avif", "50"], ["webp", "78"]];
let made = 0, skipped = 0;
for (const f of readdirSync(dir).filter((n) => /\.jpe?g$/i.test(n)).sort()) {
  const src = path.join(dir, f);
  for (const [ext, q] of jobs) {
    const out = path.join(dir, f.replace(/\.jpe?g$/i, `.${ext}`));
    // Re-encode only when the source is newer than the output.
    if (existsSync(out) && statSync(out).mtimeMs >= statSync(src).mtimeMs) { skipped++; continue; }
    execFileSync("convert", [src, "-strip", "-resize", `${WIDTH}x`, "-quality", q, out]);
    made++;
  }
}
console.log(`covers: ${made} encoded, ${skipped} up to date`);
