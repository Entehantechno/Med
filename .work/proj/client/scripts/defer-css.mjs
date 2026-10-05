/* defer-css.mjs — post-process Vite's index.html for faster LCP.

   Vite normally emits render-blocking <link rel="stylesheet"> tags in <head>.
   For this React SPA we already include a small static landing shell in HTML;
   deferring the full app CSS lets that shell paint sooner while a tiny external
   CSP-safe script upgrades the preloads to stylesheets immediately after parse.

   No visual design is changed after the full CSS arrives. A <noscript> fallback
   preserves styling for users without JavaScript.
*/
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, "..", "dist");
const indexPath = path.join(dist, "index.html");
let html = fs.readFileSync(indexPath, "utf8");

const cssLinks = [];
html = html.replace(/<link rel="stylesheet"([^>]*?)href="([^"]+\.css)"([^>]*)>/g, (m, a, href, b) => {
  const attrs = `${a || ""}${b || ""}`;
  const crossorigin = /crossorigin/.test(attrs) ? " crossorigin" : "";
  cssLinks.push({ href, crossorigin });
  return `<link rel="preload" as="style"${crossorigin} href="${href}" data-defer-css>`;
});

if (cssLinks.length && !html.includes('/defer-css.js')) {
  const noscript = `<noscript>${cssLinks.map((l) => `<link rel="stylesheet"${l.crossorigin} href="${l.href}">`).join("")}</noscript>`;
  html = html.replace("</head>", `  <script defer src="/defer-css.js"></script>\n  ${noscript}\n</head>`);
}

// Preload the two most important Persian fonts (body + display heading) so the
// static hero text does not wait for CSS discovery. File names are hashed by Vite.
try {
  const assetsDir = path.join(dist, "assets");
  const files = fs.readdirSync(assetsDir);
  const fontPreloads = [];
  const vazir = files.find((f) => /^vazirmatn-arabic-.*\.woff2$/.test(f));
  const estedad = files.find((f) => /^estedad-arabic-900-.*\.woff2$/.test(f)) || files.find((f) => /^estedad-arabic-800-.*\.woff2$/.test(f));
  for (const f of [vazir, estedad].filter(Boolean)) {
    const href = `/assets/${f}`;
    if (!html.includes(href)) fontPreloads.push(`<link rel="preload" href="${href}" as="font" type="font/woff2" crossorigin>`);
  }
  if (fontPreloads.length) html = html.replace("<!-- PWA -->", `${fontPreloads.join("\n  ")}\n\n  <!-- PWA -->`);
} catch { /* best-effort */ }

fs.writeFileSync(indexPath, html);
console.log(`[defer-css] deferred ${cssLinks.length} CSS file(s)`);
