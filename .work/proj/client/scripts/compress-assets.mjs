/* compress-assets.mjs — precompress static files for small cPanel hosting.

   Dynamic gzip in Express is useful, but compressing the same hashed JS/CSS on
   every cold request wastes CPU. This script creates .br and .gz sidecars after
   the final build so the server can send precompressed assets directly.
*/
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, "..", "dist");
const exts = new Set([".js", ".css", ".json", ".svg", ".webmanifest", ".wasm"]);
const MIN = 1024;
let count = 0;

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (st.isFile() && exts.has(path.extname(p)) && st.size >= MIN && !p.endsWith(".gz") && !p.endsWith(".br")) compress(p);
  }
}
function writeIfSmaller(file, suffix, buf, originalSize) {
  if (buf.length >= originalSize) return;
  fs.writeFileSync(file + suffix, buf);
  count++;
}
function compress(file) {
  const src = fs.readFileSync(file);
  writeIfSmaller(file, ".br", zlib.brotliCompressSync(src, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }), src.length);
  writeIfSmaller(file, ".gz", zlib.gzipSync(src, { level: 9 }), src.length);
}

if (fs.existsSync(dist)) walk(dist);
console.log(`[compress-assets] wrote ${count} compressed sidecar file(s)`);
